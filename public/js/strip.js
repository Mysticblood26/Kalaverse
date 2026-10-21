(function () {
    var s = document.querySelector('.strip');
    if (!s) return;
    var p = s.parentElement;
    function fit() {
      var cs = getComputedStyle(p);
      var w = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (w >= 44) s.style.width = Math.floor(w / 44) * 44 + 'px';
    }
    fit();
    window.addEventListener('resize', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(p);
  })();