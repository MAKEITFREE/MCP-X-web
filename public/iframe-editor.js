(function(){
  try {
    if (window.__MX_EDITOR_INJECTED__) return; // 防止重复注入
    window.__MX_EDITOR_INJECTED__ = true;

    var isEditModeActive = false;
    var selectedElement = null;
    var overlay = null;
    var mouseMoveHandler = null;

    function createOverlay(){
      overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.border = '2px solid #1890ff';
      overlay.style.background = 'rgba(24, 144, 255, 0.1)';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '10000';
      overlay.style.transition = 'all 0.2s ease';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);
    }

    function cssEscapeIdent(ident){
      try { if (window.CSS && CSS.escape) return CSS.escape(ident); } catch(e){}
      return String(ident).replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, '\\$1');
    }

    function updateOverlay(element){
      if (!overlay || !element) return;
      var rect = element.getBoundingClientRect();
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.display = 'block';
    }

    function generateSelector(element){
      if (!element || !element.tagName) return '';
      if (element.id) return '#' + cssEscapeIdent(element.id);
      var selector = element.tagName.toLowerCase();
      var classTokens = [];
      if (element.classList && element.classList.length) {
        classTokens = Array.prototype.slice.call(element.classList);
      } else if (element.className) {
        classTokens = String(element.className).split(' ');
      }
      classTokens = classTokens.map(function(c){return c && c.trim();}).filter(Boolean);
      if (classTokens.length > 0) selector += '.' + classTokens.map(cssEscapeIdent).join('.');
      try {
        var elements = document.querySelectorAll(selector);
        if (elements.length > 1) {
          var parent = element.parentElement;
          if (parent && parent !== document.body) {
            var parentSelector = generateSelector(parent);
            selector = parentSelector + ' > ' + selector;
          }
        }
      } catch(e){}
      return selector;
    }

    function handleElementSelect(event){
      if (!isEditModeActive) return;
      event.preventDefault();
      event.stopPropagation();
      var element = event.target;
      if (!element || element === document.body || element === document.documentElement) return;
      selectedElement = element;
      updateOverlay(element);
      var elementInfo = {
        tagName: element.tagName,
        id: element.id || undefined,
        className: element.className || undefined,
        textContent: element.textContent ? element.textContent.substring(0, 100) : undefined,
        selector: generateSelector(element),
        pagePath: window.location.pathname
      };
      try {
        window.parent.postMessage({ type: 'elementSelected', data: elementInfo }, '*');
      } catch(e){}
    }

    function enable(){
      if (!overlay) createOverlay();
      document.addEventListener('click', handleElementSelect, true);
      mouseMoveHandler = function(e){
        if (!isEditModeActive) return;
        var t = e.target;
        if (t && t !== document.body && t !== document.documentElement) updateOverlay(t);
      };
      document.addEventListener('mousemove', mouseMoveHandler, true);
      try { document.body.style.cursor = 'crosshair'; } catch(e){}
    }

    function disable(){
      document.removeEventListener('click', handleElementSelect, true);
      if (mouseMoveHandler) {
        document.removeEventListener('mousemove', mouseMoveHandler, true);
        mouseMoveHandler = null;
      }
      if (overlay) overlay.style.display = 'none';
      selectedElement = null;
      try { document.body.style.cursor = ''; } catch(e){}
    }

    window.addEventListener('message', function(event){
      try {
        var data = event && event.data || {};
        if (data.type === 'toggleEditMode') {
          isEditModeActive = !!data.enabled;
          if (isEditModeActive) enable(); else disable();
        } else if (data.type === 'clearSelection') {
          selectedElement = null;
          if (overlay) overlay.style.display = 'none';
        }
      } catch(e){}
    });

    // 注入完成通知父窗口（可选）
    try { window.parent.postMessage({ type: 'mx_editor_injected' }, '*'); } catch(e){}
  } catch(e) {
    // ignore
  }
})();



