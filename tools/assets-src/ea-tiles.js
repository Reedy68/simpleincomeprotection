/* Yes/No tiles on the step form: show the chosen tile for a moment before the form moves on.
   The VM form script moves to the next step as soon as a tile is clicked. This holds the click for a short
   time, marks the tile as chosen (solid purple, white tick/cross), then lets the click through. */
(function () {
  var DELAY = 500; // milliseconds
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var item = t.closest('.vmform-display-type-image .vmform-radio-item');
    if (!item) return;
    if (item.getAttribute('data-ea-go')) { item.removeAttribute('data-ea-go'); return; } // our own replayed click: let it through
    e.preventDefault();
    e.stopImmediatePropagation();
    if (item.getAttribute('data-ea-wait')) return; // already waiting on this tile
    var group = item.closest('.vmform-radio-group') || item.parentNode;
    var others = group.querySelectorAll('.ea-picked');
    for (var i = 0; i < others.length; i++) others[i].classList.remove('ea-picked');
    item.classList.add('ea-picked');
    item.setAttribute('data-ea-wait', '1');
    setTimeout(function () {
      item.removeAttribute('data-ea-wait');
      item.setAttribute('data-ea-go', '1');
      item.click();
    }, DELAY);
  }, true);
})();
