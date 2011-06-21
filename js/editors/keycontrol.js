//= require "autocomplete"

function keycontrol(panel, event) {
  event = normalise(event);
  var ctrl = event.ctrlKey;

  if (ctrl && event.which == 39 && panel.id == 'javascript') {
    // go right
    editors.html.focus();
    event.stop();
  } else if (ctrl && event.which == 37 && panel.id == 'html') {
    // go left
    editors.javascript.focus();
    event.stop();
  } else if (ctrl && event.which == 49) { // 49 == 1 key
    $('#control a.source').click();
    event.stop();
  } else if (event.which == 191 && event.shiftKey && event.metaKey) {
    // show help
    console.log('showing help - TBI');
    event.stop();
  } else if (ctrl && event.which == 50) {
    $('#control a.preview').click();
    event.stop();
  } else 
  
  // these should fire when the key goes down
  if (event.type == 'keydown') {
    if (event.which == 27) {
      event.stop();
      return startComplete(panel);
    } else if (event.which == 190 && event.altKey && event.metaKey && panel.id == 'html') {
      // auto close the element
      if (panel.somethingSelected()) return;
      // Find the token at the cursor
      var cur = panel.getCursor(false), token = panel.getTokenAt(cur), tprop = token;
      // If it's not a 'word-style' token, ignore the token.
      if (!/^[\w$_]*$/.test(token.string)) {
        token = tprop = {start: cur.ch, end: cur.ch, string: "", state: token.state,
                         className: token.string == "." ? "js-property" : null};
      }
    
      panel.replaceRange('</' + token.state.htmlState.context.tagName + '>', {line: cur.line, ch: token.end}, {line: cur.line, ch: token.end});
      event.stop();
    } else if (event.which == 188 && event.ctrlKey && event.shiftKey) {
      // start a new tag
      event.stop();
      return startTagComplete(panel);
    } else if (event.which == 191 && event.metaKey) {
      // auto close the element
      if (panel.somethingSelected()) return;
    
      var cur = panel.getCursor(false), 
          token = panel.getTokenAt(cur),
          type = token && token.state && token.state.token ? token.state.token.name : 'javascript',
          line = panel.getLine(cur.line);

      if (type == 'css') {
        if (line.match(/\s*\/\*/) !== null) {
          // already contains comment - remove
          panel.setLine(cur.line, line.replace(/\/\*\s?/, '').replace(/\s?\*\//, ''));
        } else {
          // panel.replaceRange('// ', {line: cur.line, ch: 0}, {line: cur.line, ch: 0});      
          panel.setLine(cur.line, '/* ' + line + ' */');
        }
      } else if (type == 'javascript') {
        // FIXME - could put a JS comment next to a <script> tag
        if (line.match(/\s*\/\//) !== null) {
          // already contains comment - remove
          panel.setLine(cur.line, line.replace(/(\s*)\/\/\s?/, '$1'));
        } else {
          // panel.replaceRange('// ', {line: cur.line, ch: 0}, {line: cur.line, ch: 0});      
          panel.setLine(cur.line, '// ' + line);
        }      
      } else if (type == 'html') {
        if (line.match(/\s*<!--/) !== null) {
          // already contains comment - remove
          panel.setLine(cur.line, line.replace(/<!--\s?/, '').replace(/\s?-->/, ''));
        } else {
          // panel.replaceRange('// ', {line: cur.line, ch: 0}, {line: cur.line, ch: 0});      
          panel.setLine(cur.line, '<!-- ' + line + ' -->');
        }      
      }

      event.stop();
    }
  }
  // return true;
  
  if (event.stopping) {
    return false;
  }
}

function normalise(event) {
  var myEvent = {
    type: event.type,
    which: event.which,
    metaKey: event.metaKey,
  	shiftKey: event.shiftKey,
  	ctrlKey: event.ctrlKey,
  	altKey: event.altKey
  };
  
  if ( event.which == null && (event.charCode != null || event.keyCode != null) ) {
		myEvent.which = event.charCode != null ? event.charCode : event.keyCode;
	} 	

	// Add metaKey to non-Mac browsers (use ctrl for PC's and Meta for Macs)
	if ( !event.metaKey && event.ctrlKey ) {
		myEvent.metaKey = event.ctrlKey;
	}
	
	var oldStop = event.stop;
	myEvent.stop = function () {
	  myEvent.stopping = true;
	  oldStop.call(event);
	};
	
	return myEvent;
}