$(function() {
    // Build "dynamic" rulers by adding items
    $(".ruler[data-items]").each(function() {
        var ruler = $(this).empty(),
            len = Number(ruler.attr("data-items")) || 0,
            item = $(document.createElement("button")),
            i;

        item.attr("toggledOn", "false");

        // TODO: Allow toggling between little-endian and big-endian representation.
        for (i = len - 1; i >= 0; i--) {
            ruler.append(item.clone().text(i));
        }
    });

    $("button").click(function() {
        var bitmaskDiv = $("#rulerBitmaskText");
        var bitmaskStringVal = parseInt($(bitmaskDiv).text(), 16);
        var buttonVal = parseInt(this.innerHTML, 10);

        if ($(this).attr("toggledOn") === "true") {
            $(this).attr("toggledOn", "false");
            $(this).css("background", "lightYellow");
            bitmaskStringVal &= ~(1 << buttonVal);
        } else {
            $(this).attr("toggledOn", "true");
            $(this).css("background", "tan");
            bitmaskStringVal |= (1 << buttonVal);
        }

        // Javascript and its fantastic integer handling.
        $(bitmaskDiv).text("0x" + ((bitmaskStringVal >>> 0).toString(16)));
    });

    // Change the spacing programmatically
    function changeRulerSpacing(spacing) {
        $(".ruler").
          css("padding-right", spacing).
          find("li").
            css("padding-left", spacing);
    }
});