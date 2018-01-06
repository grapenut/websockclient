//////////////////////////////////////////////////////////////////
// WebSockClient for PennMUSH
// There is no license. Just make a neato game with it.
//////////////////////////////////////////////////////////////////

var WSClient = (function (window, document, undefined) {

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  // MU* protocol carried over the WebSocket API.
  function Connection(url) {
    var that = this;

    this.socket = new window.WebSocket(url);

    this.socket.onopen = function (evt) {
      Connection.onopen(that, evt);
    };

    this.socket.onerror = function (evt) {
      Connection.onerror(that, evt);
    };

    this.socket.onclose = function (evt) {
      Connection.onclose(that, evt);
    };

    this.socket.onmessage = function (evt) {
      Connection.onmessage(that, evt);
    };
  }

  Connection.CHANNEL_TEXT = 't';
  Connection.CHANNEL_JSON = 'j';
  Connection.CHANNEL_HTML = 'h';
  Connection.CHANNEL_PUEBLO = 'p';
  Connection.CHANNEL_PROMPT = '>';

  Connection.onopen = function (that, evt) {
    that.onOpen && that.onOpen(evt);
  };

  Connection.onerror = function (that, evt) {
    that.onError && that.onError(evt);
  };

  Connection.onclose = function (that, evt) {
    that.onClose && that.onClose(evt);
  };

  Connection.onmessage = function (that, evt) {
    that.onMessage && that.onMessage(evt.data[0], evt.data.substring(1));
  };

  Connection.prototype.close = function () {
    this.socket.close();
  };

  Connection.prototype.sendText = function (data) {
    (this.socket.readyState === 1) && this.socket.send(Connection.CHANNEL_TEXT + data + '\r\n');
  };

  Connection.prototype.sendObject = function (data) {
    this.socket.send(Connection.CHANNEL_JSON + window.JSON.stringify(data));
  };

  Connection.prototype.onOpen = null;
  Connection.prototype.onClose = null;

  Connection.prototype.onMessage = function (channel, data) {
    switch (channel) {
    case Connection.CHANNEL_TEXT:
      this.onText && this.onText(data);
      break;

    case Connection.CHANNEL_JSON:
      this.onObject && this.onObject(window.JSON.parse(data));
      break;

    case Connection.CHANNEL_HTML:
      if (this.onHTML) {
        var div = document.createElement('div');
        div.innerHTML = data;

        var fragment = document.createDocumentFragment();
        for (var child = div.firstChild; child; child = child.nextSibling) {
          fragment.appendChild(child);
        }

        this.onHTML(fragment);
      }
      break;

    case Connection.CHANNEL_PUEBLO:
      if (this.onPueblo) {
        var tag, attrs;

        var idx = data.indexOf(' ');
        if (idx !== -1) {
          tag = data.substring(0, idx);
          attrs = data.substring(idx + 1);
        } else {
          tag = data;
          attrs = '';
        }

        this.onPueblo(tag.toUpperCase(), attrs);
      }
      break;
    
    case Connection.CHANNEL_PROMPT:
      this.onPrompt && this.onPrompt(data);
      break;

    default:
      window.console && window.console.log('unhandled message', channel, data);
      return false;
    }

    return true;
  };

  Connection.prototype.onText = null;
  Connection.prototype.onObject = null;
  Connection.prototype.onHTML = null;
  Connection.prototype.onPueblo = null;
  Connection.prototype.onPrompt = null;

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  // MU* terminal emulator.
  function Terminal(root) {
    this.root = root;
    this.stack = [root];

    this.state = Terminal.PARSE_PLAIN;
    this.line = null;
    this.lineBuf = [];
    this.span = null;
    this.parseBuf = '';

    this.ansiClass = '';
    this.ansiState = null;
    this.ansiDirty = false;
  }

  Terminal.PARSE_PLAIN = 0;
  Terminal.PARSE_CR = 1;
  Terminal.PARSE_ESC1 = 2;
  Terminal.PARSE_ESC2 = 3;

  Terminal.ANSI_NORMAL = 0;
  Terminal.ANSI_BRIGHT = 1;
  Terminal.ANSI_UNDERLINE = 4;
  Terminal.ANSI_BLINK = 5;
  Terminal.ANSI_INVERSE = 7;
  Terminal.ANSI_XTERM_FG = 38;
  Terminal.ANSI_XTERM_BG = 48;

  Terminal.DEFAULT_FG = 37;
  Terminal.DEFAULT_BG = 30;

  Terminal.encodeState = function (state) {
    if (!state) {
      return '';
    }

    var classes = [];

    if (state[Terminal.ANSI_INVERSE]) {
      var value = state.fg;
      state.fg = state.bg;
      state.bg = value;
      
      value = state.fg256;
      state.fg256 = state.bg256;
      state.bg256 = value;
    }
    
    var fg = state.fg;
    var bg = state.bg;
    
    if (state[Terminal.ANSI_UNDERLINE]) {
      classes[classes.length] = 'ansi-' + Terminal.ANSI_UNDERLINE;
    }

    // make sure to avoid conflict with XTERM256 color's usage of blink (code 5)
    if (state.fg256) {
      classes[classes.length] = 'ansi-38-5-' + state.fg;
    } else {  
      if (state[Terminal.ANSI_BRIGHT]) {
        if (state[Terminal.ANSI_INVERSE]) {
          if (fg !== Terminal.DEFAULT_FG) {
            classes[classes.length] = 'ansi-' + fg;
          }
        } else {
          classes[classes.length] = 'ansi-1-' + fg;
        }
      } else if (fg !== Terminal.DEFAULT_FG) {
        classes[classes.length] = 'ansi-' + fg;
      }
    }
    
    if (state.bg256) {
      classes[classes.length] = 'ansi-48-5-' + state.bg;
    } else {
      if (state[Terminal.ANSI_BRIGHT]) {
        if (state[Terminal.ANSI_INVERSE]) {
          classes[classes.length] = 'ansi-1-' + (bg + 10);
        } else {
          if (bg !== Terminal.DEFAULT_BG) {
            classes[classes.length] = 'ansi-' + (bg + 10);
          }
        }
      } else if (bg !== Terminal.DEFAULT_BG) {
        classes[classes.length] = 'ansi-' + (bg + 10);
      }
    }

    if (state[Terminal.ANSI_BLINK] && !(state.fg256 || state.bg256)) {
      classes[classes.length] = 'ansi-' + Terminal.ANSI_BLINK;
    }
    
    return classes.join(' ');
  };

  Terminal.prototype.getANSI = function () {
    if (!this.ansiState) {
      this.ansiState = {
        fg: Terminal.DEFAULT_FG,
        bg: Terminal.DEFAULT_BG,
        fg256: false,
        bg256: false
      };
    }

    return this.ansiState;
  };

  Terminal.prototype.applyANSI = function (ansi) {
    switch (ansi.charCodeAt(ansi.length - 1)) {
    case 109: // m (SGR)
      var codes = ansi.substring(0, ansi.length - 1).split(';');

      var value, state;
      for (var ii = 0; (value = codes[ii]) !== undefined; ++ii) {
        if (value.length === 0) {
          // Empty is treated as the equivalent of 0.
          value = Terminal.ANSI_NORMAL;
        } else {
          value = parseInt(value);
        }
        
        state = this.getANSI();
        
        // check for xterm256 fg/bg first, fallback to standard codes otherwise
        if (state[Terminal.ANSI_XTERM_FG] && state[Terminal.ANSI_BLINK]) {
          if (value >= 0 && value <= 255) {
            state.fg = value;
            state.fg256 = true;
            state[Terminal.ANSI_XTERM_FG] = false;
            state[Terminal.ANSI_BLINK] = false;
          } else {
            // invalid xterm256, let's reset the ansi state due to bad codes
            this.ansiState = null;
          }
        } else if (state[Terminal.ANSI_XTERM_BG] && state[Terminal.ANSI_BLINK]) {
          if (value >= 0 && value <= 255) {
            state.bg = value;
            state.bg256 = true;
            state[Terminal.ANSI_XTERM_BG] = false;
            state[Terminal.ANSI_BLINK] = false;
          } else {
            // invalid xterm256, let's reset the ansi state due to bad codes
            this.ansiState = null;
          }
        } else {
          // detect regular ansi codes
          switch (value) {
          case Terminal.ANSI_NORMAL: // reset
            this.ansiState = null;
            break;

          case Terminal.ANSI_BRIGHT:
          case Terminal.ANSI_UNDERLINE:
          case Terminal.ANSI_BLINK:
          case Terminal.ANSI_INVERSE:
          case Terminal.ANSI_XTERM_FG:
          case Terminal.ANSI_XTERM_BG:
            state[value] = true;
            break;

          default:
            if (30 <= value && value <= 37) {
              state.fg = value;
            } else if (40 <= value && value <= 47) {
              state.bg = value - 10;
            }
           break;
          }
        }

        this.ansiDirty = true;
      }
      break;
    }
  };

  Terminal.prototype.write = function (value, start, end) {
    if (start === end) {
      return;
    }

    if (this.ansiDirty) {
      var next = Terminal.encodeState(this.ansiState);

      if (this.ansiClass !== next) {
        this.ansiClass = next;
        this.span = null;
      }

      this.ansiDirty = false;
    }

    if (this.ansiClass && !this.span) {
      this.span = document.createElement('span');
      this.span.className = this.ansiClass;
      this.stack[this.stack.length - 1].appendChild(this.span);
    }

    var text = document.createTextNode(value.substring(start, end));
    this.lineBuf[this.lineBuf.length] = text;

    this.appendHTML(text);
  };

  Terminal.prototype.endLine = function () {
    this.onLine && this.onLine(this.lineBuf);

    this.write('\n', 0, 1);
    this.lineBuf.length = 0;
  };

  Terminal.prototype.abortParse = function (value, start, end) {
    switch (this.state) {
    case Terminal.PARSE_PLAIN:
      this.write(value, start, end);
      break;

    case Terminal.PARSE_ESC1:
      this.write('\u001B', 0, 1);
      break;

    case Terminal.PARSE_ESC2:
      this.write('\u001B[', 0, 2);
      this.write(this.parseBuf, 0, this.parseBuf.length);
      this.parseBuf = '';
      break;
    }
  };

  Terminal.prototype.appendText = function (data) {
    var start = 0;

    // Scan for sequence start characters.
    // TODO: Could scan with RegExp; not convinced sufficiently simpler/faster.
    for (var ii = 0, ilen = data.length; ii < ilen; ++ii) {
      var ch = data.charCodeAt(ii);

      // Resynchronize at special characters.
      switch (ch) {
      case 10: // newline
        if (this.state !== Terminal.PARSE_CR) {
          this.abortParse(data, start, ii);
          this.endLine();
        }

        start = ii + 1;
        this.state = Terminal.PARSE_PLAIN;
        continue;

      case 13: // carriage return
        this.abortParse(data, start, ii);
        this.endLine();
        start = ii + 1;
        this.state = Terminal.PARSE_CR;
        continue;

      case 27: // escape
        this.abortParse(data, start, ii);
        start = ii + 1;
        this.state = Terminal.PARSE_ESC1;
        continue;
      }

      // Parse other characters.
      switch (this.state) {
      case Terminal.PARSE_CR:
        this.state = Terminal.PARSE_PLAIN;
        break;

      case Terminal.PARSE_ESC1:
        if (ch === 91) {
          // Start of escape sequence (\e[).
          start = ii + 1;
          this.state = Terminal.PARSE_ESC2;
        } else {
          // Not an escape sequence.
          this.abortParse(data, start, ii);
          start = ii;
          this.state = Terminal.PARSE_PLAIN;
        }
        break;

      case Terminal.PARSE_ESC2:
        if (64 <= ch && ch <= 126) {
          // End of escape sequence.
          this.parseBuf += data.substring(start, (start = ii + 1));
          this.applyANSI(this.parseBuf);
          this.parseBuf = '';
          this.state = Terminal.PARSE_PLAIN;
        }
        break;
      }
    }

    // Handle tail.
    switch (this.state) {
    case Terminal.PARSE_PLAIN:
      this.write(data, start, data.length);
      break;

    case Terminal.PARSE_ESC2:
      this.parseBuf += data.substring(start);
      break;
    }
  };

  Terminal.prototype.appendHTML = function (fragment) {
    (this.span || this.stack[this.stack.length - 1]).appendChild(fragment);

    // TODO: May want to animate this, to make it less abrupt.
    this.root.scrollTop = this.root.scrollHeight;
  };

  Terminal.prototype.pushElement = function (element) {
    this.span = null;
    this.stack[this.stack.length - 1].appendChild(element);
    this.stack[this.stack.length] = element;
  };

  Terminal.prototype.popElement = function () {
    this.span = null;

    if (this.stack.length > 1) {
      --this.stack.length;
    } else {
      window.console && window.console.warn('element stack underflow');
    }
  };

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  // Example onLine() handler that linkifies URLs in text.
  function LinkHandler(lineBuf) {
    // Merge text so we can scan it.
    if (!lineBuf.length) {
      return;
    }

    var line = '';
    for (var ii = 0, ilen = lineBuf.length; ii < ilen; ++ii) {
      line += lineBuf[ii].nodeValue;
    }

    // Scan the merged text for links.
    var links = LinkHandler.scan(line);
    if (!links.length) {
      return;
    }

    // Find the start and end text nodes.
    var nodeIdx = 0, nodeStart = 0, nodeEnd = lineBuf[0].nodeValue.length;
    for (var ii = 0, ilen = links.length; ii < ilen; ++ii) {
      var info = links[ii], startOff, startNode, endOff, endNode;

      while (nodeEnd <= info.start) {
        nodeStart = nodeEnd;
        nodeEnd += lineBuf[++nodeIdx].nodeValue.length;
      }

      startOff = info.start - nodeStart;
      startNode = lineBuf[nodeIdx];

      while (nodeEnd < info.end) {
        nodeStart = nodeEnd;
        nodeEnd += lineBuf[++nodeIdx].nodeValue.length;
      }

      endOff = info.end - nodeStart;
      endNode = lineBuf[nodeIdx];

      // Wrap the link text.
      // TODO: In this version, we won't try to cross text nodes.
      // TODO: Discard any text nodes that are already part of links?
      if (startNode !== endNode) {
        window.console && window.console.warn('link', info);
        continue;
      }

      lineBuf[nodeIdx] = endNode.splitText(endOff);
      nodeStart += endOff;

      var middleNode = startNode.splitText(startOff);
      var anchor = document.createElement('a');
      middleNode.parentNode.replaceChild(anchor, middleNode);

      anchor.target = '_blank';
      if (info.url === '' && info.xch_cmd !== '') {
        anchor.setAttribute('onClick', 'xch_cmd("'+info.xch_cmd+'");');
      } else {
        anchor.href = info.url;
      }
      anchor.appendChild(middleNode);
    }
  }

  // Link scanner function.
  // TODO: Customizers may want to replace this, since regular expressions
  // ultimately limit how clever our heuristics can be.
  LinkHandler.scan = function (line) {
    var links = [], result;

    LinkHandler.regex.lastIndex = 0;
    while ((result = LinkHandler.regex.exec(line))) {
      var info = {};

      info.start = result.index + result[1].length;
      info.xch_cmd = '';
      if (result[2]) {
        result = result[2];
        info.url = result;
      } else if (result[3]) {
        result = result[3];
        info.url = 'mailto:' + result;
      } else if (result[4]) {
        result = result[4];
        info.url = '';
        info.xch_cmd = 'help ' + result;
        info.className = "ansi-1-37";
      }

      info.end = info.start + result.length;

      links[links.length] = info;
    }

    return links;
  };

  // LinkHandler regex:
  //
  // 1. Links must be preceded by a non-alphanumeric delimiter.
  // 2. Links are matched greedily.
  // 3. URLs must start with a supported scheme.
  // 4. E-mail addresses are also linkified.
  // 5. Twitter users and hash tags are also linkified.
  //
  // TODO: This can be improved (but also customized). One enhancement might be
  // to support internationalized syntax.
  LinkHandler.regex = /(^|[^a-zA-Z0-9]+)(?:((?:http|https):\/\/[-a-zA-Z0-9_.~:\/?#[\]@!$&'()*+,;=%]+)|([-.+a-zA-Z0-9_]+@[-a-zA-Z0-9]+(?:\.[-a-zA-Z0-9]+)+)|(@[a-zA-Z]\w*))/g;

  Terminal.prototype.onLine = LinkHandler;

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////

  // Module exports.
  var exports = {};

  exports.open = function (url) {
    return new Connection(url);
  };

  exports.emulate = function (root) {
    return new Terminal(root);
  };
  
  // export the LinkHandler just in case it's useful elsewhere
  exports.LinkHandler = LinkHandler;
  
  return exports;
})(window, document);

