function showImage(src) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    lightboxImage.src = src;
    lightboxImage.style.transform = 'translate(-50%, -50%) scale(0)';
    lightbox.style.display = 'block';
    setTimeout(() => {
        lightboxImage.style.transform = 'translate(-50%, -50%) scale(0.5)';
    }, 50);
}

function closeImageInstant() {
    const lightbox = document.getElementById('lightbox');
    lightbox.style.display = 'none';
}
