// Image upload and management functionality

// Generate a unique key for dish images
function getImageKey(dishName, menuType, date) {
    return `img_${date}_${dishName.replace(/[^a-zA-Z0-9]/g, '_')}_${menuType.replace(/[^a-zA-Z0-9]/g, '_')}`;
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

// Handle camera/upload button click
function handleImageUpload(dishName, menuType) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Prefer rear camera for food photos
    
    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Show loading state
        const imageKey = getImageKey(dishName, menuType, currentDate);
        const button = document.querySelector(`[data-upload-key="${imageKey}"]`);
        if (button) {
            button.innerHTML = '<span class="text-lg">⏳</span>';
            button.disabled = true;
        }

        try {
            await uploadImage(dishName, menuType, file);
            
            // Success feedback
            if (button) {
                button.innerHTML = '<span class="text-lg">✅</span>';
                setTimeout(() => {
                    button.innerHTML = '<span class="text-lg">📷</span>';
                    button.disabled = false;
                }, 2000);
            }

            // Refresh image counts to update the view button
            setTimeout(() => refreshImageCounts(), 100);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload image: ' + error.message);
            
            // Reset button
            if (button) {
                button.innerHTML = '<span class="text-lg">📷</span>';
                button.disabled = false;
            }
        }
    };
    
    input.click();
}

// Show images modal
async function showImages(dishName, menuType) {
    try {
        const images = await getImages(dishName, menuType);
        
        if (images.length === 0) {
            alert('No photos available for this dish yet.');
            return;
        }

        // Create modal
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
            <h3 class="text-white font-semibold">Photos: ${dishName}</h3>
            <button onclick="this.closest('.fixed').remove()" class="text-ios-gray-2 text-xl">×</button>
        `;

        const imageGrid = document.createElement('div');
        imageGrid.className = 'p-4 space-y-4';

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

        content.appendChild(header);
        content.appendChild(imageGrid);
        modal.appendChild(content);
        document.body.appendChild(modal);

    } catch (error) {
        console.error('Failed to load images:', error);
        alert('Failed to load images');
    }
}

// Generate image upload/view HTML for a menu item
function generateImageHtml(dishName, menuType) {
    if (!IMAGE_CONFIG.enabled) {
        return '';
    }

    const imageKey = getImageKey(dishName, menuType, currentDate);

    return `
        <div class="border-t border-ios-gray border-opacity-20 pt-3 mt-3" data-image-container="${imageKey}">
            <div class="flex justify-between items-center">
                <span class="text-ios-gray-2 text-sm font-medium">Photos:</span>
                <div class="flex gap-2">
                    <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center" 
                            onclick="handleImageUpload('${dishName.replace(/'/g, "\\'")}', '${menuType}')"
                            data-upload-key="${imageKey}">
                        <span class="text-lg">📷</span>
                    </button>
                    <button class="vote-button swiftui-button px-3 py-2 rounded-lg flex items-center hidden" 
                            onclick="showImages('${dishName.replace(/'/g, "\\'")}', '${menuType}')"
                            data-view-key="${imageKey}">
                        <span class="text-lg">🖼️</span>
                        <span class="text-lg" data-image-count="${imageKey}">0</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Load image count for a specific item and update the display
async function loadImagesForItem(imageKey) {
    if (!IMAGE_CONFIG.enabled) {
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), IMAGE_CONFIG.timeout);

        const response = await fetch(`${IMAGE_CONFIG.apiUrl}?key=${encodeURIComponent(imageKey)}`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        let imageCount = 0;
        if (response.ok) {
            const data = await response.json();
            imageCount = data.success ? data.images.length : 0;
        }

        // Find the image container for this item
        const imageContainer = document.querySelector(`[data-image-container="${imageKey}"]`);
        if (imageContainer) {
            const viewButton = imageContainer.querySelector(`[data-view-key="${imageKey}"]`);
            const countElement = imageContainer.querySelector(`[data-image-count="${imageKey}"]`);
            
            if (viewButton && countElement) {
                if (imageCount > 0) {
                    // Show button and update count
                    viewButton.classList.remove('hidden');
                    countElement.textContent = imageCount;
                } else {
                    // Hide button if no images
                    viewButton.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        console.log('Failed to load image count:', error);
    }
}

// Load all visible image counts
async function refreshImageCounts() {
    if (!IMAGE_CONFIG.enabled) return;
    
    const imageContainers = document.querySelectorAll('[data-image-container]');
    const loadPromises = Array.from(imageContainers).map(container => {
        const imageKey = container.getAttribute('data-image-container');
        return loadImagesForItem(imageKey);
    });
    
    // Load all image counts in parallel
    await Promise.all(loadPromises);
}