//console.log("content.js load")

// Register event listeners for drag-and-drop and paste events
document.addEventListener('drop', handleEvent);
document.addEventListener('paste', handleEvent);

// Supported image MIME type list
const SUPPORTED_IMAGE_TYPES = [
    'image/webp', 
    'image/bmp', 
    'image/svg+xml', 
    'image/avif'
];

/**
 * Handle events and filtering for supported image types.
 *
 * @param {Event} event - The drop or paste event object.
 */
async function handleEvent(event) {

    if (!event.isTrusted) return;

    if (event.type === 'paste' && !event.clipboardData) {
        console.error("EIF [handleEvent]: Clipboard data is null or undefined.");
        return;
    }

    const items = getEventItems(event);
    if (!items) {
        console.error("EIF [handleEvent]: Unable to retrieve event items.");
        return;
    }

    const imageFiles = filterSupportedImages(items);
    if (imageFiles.length === 0) {
        //console.warn("EIF [handleEvent]: No supported image files found.");
        return;
    }

    event.preventDefault();

    try {
        const dataTransfer = await convertDataTransfer(imageFiles);
        triggerEvent(dataTransfer, event);
    } catch (error) {
        console.error("EIF [handleEvent]:", error);
    } 
}


/**
 * Return the required DataTransferItems based on the event type.
 *
 * @param {Event} event - The drop or paste event object.
 * @returns {DataTransferItemList | null} - List of items, or null if unsupported event.
 */
function getEventItems(event) {
    if (event.type === 'drop') return event.dataTransfer.items;
    if (event.type === 'paste') return event.clipboardData.items;
    console.error("EIF [getEventItems]: Unsupported event type.", event.type);
    return null;
}


/**
 * Filter supported image files from the event items.
 *
 * @param {DataTransferItemList} items - List of event items.
 * @returns {File[]} - List of supported image files.
 */
function filterSupportedImages(items) {
    if (!items || typeof items !== 'object' || typeof items.length !== 'number') {
        console.error("EIF [filterSupportedImages]: Invalid items structure.");
        return [];
    }
    const imageFiles = [];

    // #Note: 
    // I don't know why, The AVIF format does not support Google Docs explicitly.
    // But it works internally. Maybe they will support format someday.
    const isGoogleDocs = window.location.href.startsWith('https://docs.google.com/document/');
    const shouldSkipFile = (type) => type === 'image/avif' && isGoogleDocs;

    Array.from(items).forEach(item => {
        const file = item.getAsFile();
        const { kind, type } = item;

        if (kind === 'file' && file && SUPPORTED_IMAGE_TYPES.includes(type) && !shouldSkipFile(type)) {
            imageFiles.push(file);
        }
    });

    return imageFiles;
}





/**
 * Image Date Processing Code.
 */

/**
 * Convert the array of image files to PNG format.
 * Then them to a DataTransfer object.
 *
 * @param {File[]} files - Array of files to process.
 * @returns {DataTransfer} - The DataTransfer object containing the converted files.
 */
async function convertDataTransfer(files) {
    const dataTransfer = new DataTransfer();

    const processFile = async (file) => {
        const dataURL = await readFile(file);
        const img = await loadImage(dataURL);
        const pngBlob = await convertImage2PNGBlob(img);
        const pngFile = new File([pngBlob], file.name.replace(/\.\w+$/, '.png'), { type: 'image/png' });
        return pngFile;
    };

    const processedFiles = await Promise.all(files.map(processFile));
    processedFiles.forEach((file) => dataTransfer.items.add(file));

    return dataTransfer;
}


/**
 * Read the given file and return its data URL as a string.
 *
 * @param {File} file - The file to read.
 * @returns {Promise<string>} The promise that resolves with the data URL of the file.
 */
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


/**
 * Load the image from the given data URL.
 *
 * @param {string} dataURL - The data URL of the image.
 * @returns {Promise<HTMLImageElement>} The promise that resolves with the loaded image.
 */
function loadImage(dataURL) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataURL;
    });
}


/**
 * Convert the image element to the PNG blob.
 *
 * @param {HTMLImageElement} image - The image element to convert.
 * @returns {Promise<Blob>} The promise that resolves with the PNG blob.
 */
function convertImage2PNGBlob(image) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}





/**
 * Custom Event Processing Code.
 */

/**
 * Create a new custom event and dispatch it.
 *
 * @param {DataTransfer} dataTransfer - The DataTransfer object to attach to the new event.
 * @param {Event} originalEvent - The original event to copy properties from.
 */
function triggerEvent(dataTransfer, originalEvent) {
    const newEvent = createNewEvent(dataTransfer, originalEvent);
    if (newEvent) dispatchNewEvent(newEvent);
    else console.error("EIF [triggerEvent]: Failed to create a new event.");
}


/**
 * Create a new drop or paste event with the modified DataTransfer object.
 *
 * @param {DataTransfer} dataTransfer - The DataTransfer object to attach to the new event.
 * @param {Event} originalEvent - The original event to copy properties from.
 * @returns {Event | null} - A new drop or paste event, or null if event type is unsupported.
 */
function createNewEvent(dataTransfer, originalEvent) {
    if (originalEvent.type === 'drop') return createNewDropEvent(dataTransfer, originalEvent);
    if (originalEvent.type === 'paste') return createNewPasteEvent(dataTransfer, originalEvent);
    console.error("EIF [createNewEvent]: Unsupported event type.", originalEvent.type);
    return null
}


/**
 * Create the new drop event with the given DataTransfer and original event properties.
 *
 * @param {DataTransfer} dataTransfer - The DataTransfer object to attach to the new event.
 * @param {DragEvent} originalEvent - The original drop event.
 * @returns {DragEvent} The newly created drop event.
 */
function createNewDropEvent(dataTransfer, originalEvent) {
    const newEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: originalEvent.clientX,
        clientY: originalEvent.clientY,
        screenX: originalEvent.screenX,
        screenY: originalEvent.screenY,
        dataTransfer: dataTransfer,
        sourceCapabilities: originalEvent.sourceCapabilities
    });

    Object.defineProperty(newEvent, 'srcElement', { value: originalEvent.srcElement });
    Object.defineProperty(newEvent, 'target', { value: originalEvent.target });

    newEvent.dataTransfer.dropEffect = originalEvent.dataTransfer.dropEffect;
    newEvent.dataTransfer.effectAllowed = originalEvent.dataTransfer.effectAllowed;

    return newEvent;
}


/**
 * Create the new paste event with the given DataTransfer and original event properties.
 *
 * @param {DataTransfer} dataTransfer - The DataTransfer object to attach to the new event.
 * @param {ClipboardEvent} originalEvent - The original paste event.
 * @returns {ClipboardEvent} The newly created paste event.
 */
function createNewPasteEvent(dataTransfer, originalEvent) {
    const newEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
        composed: true
    });

    Object.defineProperty(newEvent, 'srcElement', { value: originalEvent.srcElement });
    Object.defineProperty(newEvent, 'target', { value: originalEvent.target });
    Object.defineProperty(newEvent, 'currentTarget', { value: originalEvent.currentTarget });

    newEvent.clipboardData.dropEffect = 'none';
    newEvent.clipboardData.effectAllowed = 'uninitialized';

    return newEvent;
}


/**
 * Dispatch the new event to the target element.
 *
 * @param {Event} event - The event to dispatch.
 */
function dispatchNewEvent(event) {
    const targetElement = getTargetElement(event);

    if (!targetElement) {
        console.error("EIF [dispatchNewEvent]: Target element is undefined.");
        return;
    }

    targetElement.dispatchEvent(event);
}


/**
 * Return the required target element based on the event type.
 *
 * @param {Event} event - The drop or paste event object.
 * @returns {HTMLElement | null} - The target element, or null if unsupported event.
 */
function getTargetElement(event) {
    if (event.type === 'drop') return document.elementFromPoint(event.clientX, event.clientY);
    if (event.type === 'paste') return document.activeElement;
    console.error("EIF [getTargetElement]: Unsupported event type.", event.type);
    return null;
}
