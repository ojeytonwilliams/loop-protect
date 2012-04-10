var $document = $(document);

var editorModes = {
  html: 'htmlmixed',
  javascript: 'javascript',
  css: 'css'
};

var Panel = function (name, settings) {
  var panel = this;
  panel.settings = settings = settings || {};
  panel.id = panel.name = name;
  panel.$el = $('.panel.' + name);
  panel.el = document.getElementById(name);
  panel.order = Panel.order++;

  var splitterSettings = {};

  if (settings.editor) {
    panel.editor = CodeMirror.fromTextArea(panel.el, {
      parserfile: [],
      tabMode: 'shift',
      dragDrop: false, // we handle it ourselves
      mode: editorModes[name],
      onChange: function (event) { 
        $document.trigger('codeChange', [{ panelId: panel.id, revert: true }]); 
        return true; 
      },
      lineWrapping: true,
      theme: jsbin.settings.codemirror.theme || 'jsbin'
    });

    panel.processor = settings.processor || function (str) { return str; };

    panel._setupEditor(panel.editor, name);
  } 

  if (!settings.nosplitter) {
    panel.splitter = panel.$el.splitter(splitterSettings).data('splitter');
    panel.splitter.hide();
  } else {
    // create a fake splitter to let the rest of the code work
    panel.splitter = $();
  }

  if (settings.beforeRender) {
    $document.bind('render', $.proxy(settings.beforeRender, panel));
  }

  if (!settings.editor) {
    panel.ready = true;
  }

  // append panel to controls

  this.controlButton = $('<a class="button group" href="#' + name + '">' + (settings.label || name) + '</a>');
  this.controlButton.click(function () {
    panel.toggle();
    return false;
  });
  this.controlButton.appendTo('#panels');

  this.$el.focus(function () {
    jsbin.panels.focus(panel);
  });
  this.$el.click(function () {
    panel.$el.trigger('focus');
  });
}

Panel.order = 0;

Panel.prototype = {
  virgin: true,
  visible: false,
  show: function (x) {
    // check to see if there's a panel to the left.
    // if there is, take it's size/2 and make this our
    // width
    var panel = this;

    panel.$el.show();
    panel.splitter.show();
    panel.visible = true;
    if (panel.settings.show) {
      panel.settings.show.call(panel, true);
    }
    panel.controlButton.addClass('active');

    // update the splitter - but do it on the next tick
    // required to allow the splitter to see it's visible first
    setTimeout(function () {
      if (x !== undefined) {
        panel.splitter.trigger('init', x);
      } else {
        panel.distribute();
      }
      // update all splitter positions
      $document.trigger('sizeeditors');
      if (panel.editor) {
        // populate the panel for the first time
        if (panel.virgin) {
          $(panel.editor.win).find('.CodeMirror-scroll > div').css('padding-top', panel.$el.find('> .label').outerHeight());
          populateEditor(panel, panel.name);
        }
        panel.editor.focus();
      }
      jsbin.panels.focus(panel);
      panel.virgin = false;
  }, 0); 

    // TODO save which panels are visible in their profile - but check whether it's their code
  },
  hide: function () {
    var panel = this;
    panel.$el.hide();
    panel.visible = false;

    // update all splitter positions
    panel.splitter.hide();
    panel.controlButton.removeClass('active');
    panel.distribute();

    if (panel.settings.hide) {
      panel.settings.hide.call(panel, true);
    }

    // this.controlButton.show();
    $document.trigger('sizeeditors');
  },
  toggle: function () {
    (this)[this.visible ? 'hide' : 'show']();
  },
  getCode: function () {
    if (this.editor) {
      return this.editor.getCode();
    }
  },
  setCode: function (content) {
    if (this.editor) {
      this.editor.setCode(content);
    }
  },
  render: function () {
    var panel = this;
    if (panel.editor) {
      return panel.processor(panel.getCode());
    } else if (this.visible && this.settings.render) {
      this.settings.render.call(this);
    } 
  },
  init: function () {
    this.settings.init && this.settings.init.call(this);
  },
  _setupEditor: function () {
    var focusedPanel = sessionStorage.getItem('panel'),
        panel = this,
        editor = panel.editor;

    // overhang from CodeMirror1
    editor.setCode = function (str) {
      //Cannot call method 'chunkSize' of undefined
      try {
        editor.setValue(str);
      } catch(err) {
        // console.error(e.id, err + '');
      }
    };

    editor.getCode = function () {
      return editor.getValue();
    };

    editor.currentLine = function () {
      var pos = editor.getCursor();
      return pos.line;
    };

    // editor.setOption('onKeyEvent', keycontrol);
    editor.setOption('onFocus', function () {
      panel.$el.trigger('focus');
    });

    editor.id = panel.name;

    editor.win = editor.getWrapperElement();
    editor.scroller = $(editor.getScrollerElement());

    $(editor.win).click(function () {
      editor.focus();
    });

    var $label = panel.$el.find('> .label');
    if (document.body.className.indexOf('ie6') === -1 && $label.length) {
      editor.scroller.scroll(function (event) {
        if (this.scrollTop > 10) {
          $label.stop().animate({ opacity: 0 }, 20, function () {
            $(this).hide();
          });
        } else {
          $label.show().stop().animate({ opacity: 1 }, 150);
        }
      });
    }

    $document.bind('sizeeditors', function () {
      var height = panel.$el.outerHeight(),
          offset = 0;
          // offset = panel.$el.find('> .label').outerHeight();

      editor.scroller.height(height - offset);
      editor.refresh();
    });

    // required because the populate looks at the height, and at 
    // this point in the code, the editor isn't visible, the browser
    // needs one more tick and it'll be there.
    setTimeout(function () {
      // if the panel isn't visible this only has the effect of putting 
      // the code in the textarea (though probably costs us a lot more)
      // it has to be re-populated upon show for the first time because
      // it appears that CM2 uses the visible height to work out what
      // should be shown. 
      populateEditor(panel, panel.name);
      panel.ready = true;

      if (focusedPanel == panel.name || focusedPanel == null && panel.name == 'javascript') {
        editor.focus();
        editor.setCursor({ line: (sessionStorage.getItem('line') || 0) * 1, ch: (sessionStorage.getItem('character') || 0) * 1 });
      }
    }, 0);
  },
  populateEditor: function () {
    populateEditor(this, this.name);
  }
};

function populateEditor(editor, panel) {
  // populate - should eventually use: session, saved data, local storage
  var cached = sessionStorage.getItem('jsbin.content.' + panel), // session code
      saved = localStorage.getItem('saved-' + panel), // user template
      sessionURL = sessionStorage.getItem('url'),
      changed = false;

  if (template && cached == template[panel]) { // restored from original saved
    editor.setCode(cached);
  } else if (cached && sessionURL == template.url) { // try to restore the session first - only if it matches this url
    editor.setCode(cached);
    // tell the document that it's currently being edited, but check that it doesn't match the saved template
    // because sessionStorage gets set on a reload
    changed = cached != saved && cached != template[panel];
  } else if (saved !== null && !/edit/.test(window.location) && !window.location.search) { // then their saved preference
    editor.setCode(saved);
  } else { // otherwise fall back on the JS Bin default
    editor.setCode(template[panel]);
  }

  if (changed) {
    $document.trigger('codeChange', [ { revert: false, onload: true } ]);
  }
}