function playIfChecked(id, input) {
    "use strict";

    var audio = document.getElementById(id);

    var inputType = input.type;
    if (inputType === "checkbox" && input.checked) {
        audio.play();
    }
}