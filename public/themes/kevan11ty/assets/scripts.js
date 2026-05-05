(function () {
  document.addEventListener('alpine:init', function () {
    Alpine.store('background', {
      imageNumber: Math.floor(Math.random() * 25) + 1,
      updateImageNumber: function () {
        this.imageNumber = Math.floor(Math.random() * 25) + 1;
      }
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    var lastScrollTop = 0;
    var scalingFactor = 2;

    window.addEventListener('scroll', function () {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var scrollDiff = (scrollTop - lastScrollTop) * scalingFactor;
      var scroller = document.querySelector('.scroller');
      if (!scroller) return;
      var bgX = parseInt(window.getComputedStyle(scroller).backgroundPosition.split(' ')[0] || '0', 10);
      var newBgPosition = bgX + scrollDiff;
      scroller.style.backgroundPosition = newBgPosition + 'px 0px';
      lastScrollTop = scrollTop;
    }, { passive: true });
  });
})();
