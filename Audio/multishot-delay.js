function playAfterDelay(audioObject, milliseconds) {
    setTimeout(function() {
        audioObject.play();
    }, milliseconds)
}