// Image upload and management functionality

// Generate a unique key for dish images
function getImageKey(dishName, menuType, date) {
    return `img_${date}_${dishName.replace(/[^a-zA-Z0-9]/g, '_')}_${menuType.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

// Generate image button HTML that combines upload and view functionality
function generateImageButtonHtml(dishName, menuType) {
    if (!IMAGE_CONFIG.enabled) {
        return '';
    }

    const imageKey = getImageKey(dishName, menuType, currentDate);

    return `
        <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                onclick="handleImageButtonClick('${dishName.replace(/'/g, "\\'")}', '${menuType}')"
                data-image-button-key="${imageKey}">
            <span class="text-lg">📷</span>
            <span class="text-sm font-medium" data-image-count="${imageKey}">0</span>
        </button>
    `;
}

// Generate image upload/view HTML for a menu item (used when voting is not active)
function generateImageHtml(dishName, menuType) {
    if (!IMAGE_CONFIG.enabled) {
        return '';
    }

    const imageKey = getImageKey(dishName, menuType, currentDate);

    return `
        <div class="border-t border-ios-gray border-opacity-20 pt-3 mt-3" data-image-container="${imageKey}">
            <div class="flex justify-center">
                <div class="flex gap-2">
                    <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center gap-2" 
                            onclick="handleImageButtonClick('${dishName.replace(/'/g, "\\'")}', '${menuType}')"
                            data-image-button-key="${imageKey}">
                        <span class="text-lg">📷</span>
                        <span class="text-sm font-medium" data-image-count="${imageKey}">0</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Upload image for a menu item
async function uploadImage(dishName, menuType, file) {
    if (!IMAGE_CONFIG.enabled) {
        throw new Error('Image upload is disabled');
    }

    // Validate file size
    if (file.size > IMAGE_CONFIG.maxSize) {
        throw new Error('File too large. Maximum size is 5MB');
    }

    // Validate file type
    if (!IMAGE_CONFIG.allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed');
    }

    const imageKey = getImageKey(dishName, menuType, currentDate);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('key', imageKey);

    // Get Turnstile token if enabled
    if (typeof getTurnstileTokenWithUI === 'function') {
        const turnstileToken = await getTurnstileTokenWithUI('Verify Upload', 'Please verify to upload your image:');
        if (TURNSTILE_CONFIG.enabled && !turnstileToken) {
            throw new Error('Upload cancelled: Verification required');
        }
        if (turnstileToken) {
            formData.append('turnstileToken', turnstileToken);
        }
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), IMAGE_CONFIG.timeout);

        const response = await fetch(IMAGE_CONFIG.apiUrl, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Upload failed');
        }

        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Upload timeout');
        }
        if (error.message && error.message.includes('403')) {
            throw new Error('Upload rejected: Verification failed');
        }
        throw error;
    }
}

// Get images for a menu item
async function getImages(dishName, menuType) {
    if (!IMAGE_CONFIG.enabled) {
        return [];
    }

    const imageKey = getImageKey(dishName, menuType, currentDate);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), IMAGE_CONFIG.timeout);

        const response = await fetch(`${IMAGE_CONFIG.apiUrl}/${encodeURIComponent(imageKey)}`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return data.success ? data.images : [];
        }
    } catch (error) {
        console.log('Failed to load images:', error);
    }

    return [];
}

// Handle image button click - shows modal for upload and view
async function handleImageButtonClick(dishName, menuType) {
    try {
        const images = await getImages(dishName, menuType);
        
        // Create modal for both upload and view functionality
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        const content = document.createElement('div');
        content.className = 'bg-ios-dark-2 rounded-xl max-w-lg w-full max-h-96 overflow-y-auto';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center p-4 border-b border-ios-dark-4';
        header.innerHTML = `
            <h3 class="text-white font-semibold">📷 ${dishName}</h3>
            <button onclick="this.closest('.fixed').remove()" class="text-ios-gray-2 text-xl">×</button>
        `;

        const actionSection = document.createElement('div');
        actionSection.className = 'p-4 border-b border-ios-dark-4';
        actionSection.innerHTML = `
            <button onclick="triggerImageUpload('${dishName.replace(/'/g, "\\'")}', '${menuType}', this.closest('.fixed'))" 
                    class="w-full swiftui-button bg-ios-blue text-white px-4 py-3 rounded-lg font-medium">
                📷 Add Photo
            </button>
        `;

        const imageGrid = document.createElement('div');
        imageGrid.className = 'p-4 space-y-4';

        if (images.length > 0) {
            images.forEach(image => {
                const imageItem = document.createElement('div');
                imageItem.className = 'flex flex-col space-y-2';
                imageItem.innerHTML = `
                    <img src="${image.url}" alt="${image.originalName}" 
                         class="w-full h-48 object-cover rounded-lg">
                    <div class="text-ios-gray-2 text-xs">
                        <div>Uploaded: ${image.timestamp}</div>
                    </div>
                `;
                imageGrid.appendChild(imageItem);
            });
        } else {
            imageGrid.innerHTML = `
                <div class="text-center text-ios-gray-2 py-8">
                    <p>No photos yet.</p>
                    <p class="text-xs mt-2">Use the button above to add the first photo!</p>
                </div>
            `;
        }

        content.appendChild(header);
        content.appendChild(actionSection);
        content.appendChild(imageGrid);
        modal.appendChild(content);
        document.body.appendChild(modal);

    } catch (error) {
        console.error('Failed to load images:', error);
        alert('Failed to load images');
    }
}

// Trigger image upload from within modal
function triggerImageUpload(dishName, menuType, modal) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            await uploadImage(dishName, menuType, file);
            
            // Close modal and refresh image counts
            if (modal) {
                document.body.removeChild(modal);
            }
            setTimeout(() => refreshImageCounts(), 100);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload image: ' + error.message);
        }
    };
    
    input.click();
}

// Load image count for a specific item and update the display
async function loadImagesForItem(imageKey) {
    if (!IMAGE_CONFIG.enabled) {
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), IMAGE_CONFIG.timeout);

        const response = await fetch(`${IMAGE_CONFIG.apiUrl}/${encodeURIComponent(imageKey)}`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        let imageCount = 0;
        if (response.ok) {
            const data = await response.json();
            imageCount = data.success ? data.images.length : 0;
        }

        // Find the image button for this item
        const imageButton = document.querySelector(`[data-image-button-key="${imageKey}"]`);
        if (imageButton) {
            const countElement = imageButton.querySelector(`[data-image-count="${imageKey}"]`);
            if (countElement) {
                countElement.textContent = imageCount;
            }
        }
    } catch (error) {
        console.log('Failed to load image count:', error);
    }
}

// Load all visible image counts
async function refreshImageCounts() {
    if (!IMAGE_CONFIG.enabled) return;
    
    // Handle both inline image buttons (in voting row) and standalone image containers
    const imageButtons = document.querySelectorAll('[data-image-button-key]');
    const imageContainers = document.querySelectorAll('[data-image-container]');
    
    const loadPromises = [
        // Load counts for inline image buttons
        ...Array.from(imageButtons).map(button => {
            const imageKey = button.getAttribute('data-image-button-key');
            return loadImagesForItem(imageKey);
        }),
        // Load counts for standalone image containers (when voting is not active)
        ...Array.from(imageContainers).map(container => {
            const imageKey = container.getAttribute('data-image-container');
            return loadImagesForItem(imageKey);
        })
    ];
    
    // Load all image counts in parallel
    await Promise.all(loadPromises);
}