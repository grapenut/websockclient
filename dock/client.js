var Client = (function (window, document, undefined) {

  function _CLIENT() {
    this.root = null;
    this.world = new _WORLD();
    this.layout = null;
    this.savedState = null;
  }
  
  _CLIENT.baseConfig = {
    settings: {
      hasHeaders: true,
      constrainDragToContainer: false,
      reorderEnabled: true,
      selectionEnabled: false,
      popoutWholeStack: false,
      blockedPopoutsThrowError: true,
      closePopoutsOnUnload: true,
      showPopoutIcon: false,
      showMaximiseIcon: true,
      showCloseIcon: true
    },
    dimensions: {
      borderWidth: 10,
      minItemHeight: 100,
      minItemWidth: 100,
      headerHeight: 40,
      dragProxyWidth: 300,
      dragProxyHeight: 200
    },
    labels: {
      close: 'close',
      maximise: 'maximise',
      minimise: 'minimise',
      popout: 'open in new window'
    },
    content: [{
      type: 'row',
      isClosable: false,
      content: [{
        type: 'component',
        isClosable: false,
        componentName: 'Terminal',
        componentState: { }
      },{
        type: 'component',
        componentName: 'ChatWindow',
        componentState: { }
      }]
    }]
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  // initialize the window manager
  _CLIENT.prototype.initLayout = function(root) {
    if (!root) {
      return null;
    }

    var client = this;
    client.root = root;
    
    client.savedState = localStorage.getItem('savedState');
    if (client.savedState !== null) {
      client.layout = new GoldenLayout(JSON.parse(client.savedState), client.root);
    } else {
      client.layout = new GoldenLayout(_CLIENT.baseConfig, client.root);
    }
    
    // resize container with window
    $(window).resize(function() {
      client.layout.updateSize();
    });
    
    // save client layout in local storage
    client.layout.on('stateChanged', function() {
      client.savedState = JSON.stringify(client.layout.toConfig());
      localStorage.setItem('savedState', client.savedState);
    });

    // Main terminal window
    client.layout.registerComponent('Terminal', function(container, state) {
      client.initTerminal(container, state);
    });
    
    // External chat window for <Channels>
    client.layout.registerComponent('ChatWindow', function(container, state) {
      client.initChatWindow(container, state);
    });
    
    // Ace Editor window
    client.layout.registerComponent('Editor', function(container, state) {
      client.initEditor(container, state);
    });

    // Generic popup window
    client.layout.registerComponent('Window', function(container, state) {
      var div = document.createElement('div');
      div.className = "window";
      container.getElement().append(div);
    });
    
    // actually start the window manager
    client.layout.init();
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a terminal inside the given root element
  _CLIENT.prototype.initTerminal = function(container, state) {
    var root = document.createElement('div');
    root.className = "terminal";
    container.getElement().append(root);
    
    var world = this.world;
    world.terminal = root;
    
    // Build the terminal window in a document fragment
    var fragment = document.createDocumentFragment();
    
    // Output window
    world.output = WSClient.output(document.createElement('div'));
    world.output.root.className = "terminal-output ansi-37 ansi-40";
    world.output.onCommand = function(cmd) { world.onCommand(cmd); };
    fragment.appendChild(world.output.root);
    
    // Quicklinks bar
    world.quicklinks = document.createElement('div');
    world.quicklinks.className = "terminal-quicklinks ansi-37 ansi-40";
    fragment.appendChild(world.quicklinks);
    
    world.addQuickLink('WHO', 'who');
    world.addQuickLink('LOOK', 'look');
    world.addQuickLink('INVENTORY', 'inventory');
    world.addQuickLink('@MAIL', '@mail');
    world.addQuickLink('+BB', '+bb');
    world.addQuickLink('CLEAR', function() { world.output.clear(); world.prompt.clear(); world.input.clear(); });
    
    // Prompt window
    world.prompt = WSClient.output(document.createElement('div'));
    world.prompt.root.className = "terminal-prompt ansi-37 ansi-40";
    fragment.appendChild(world.prompt.root);
    
    // Input window
    world.input = WSClient.input(document.createElement('textarea'));
    world.input.root.className = "terminal-input";
    world.input.root.setAttribute('autocomplete', 'off');
    world.input.root.setAttribute('autofocus', '');
    fragment.appendChild(world.input.root);
    
    // Add our terminal components to the container
    world.terminal.appendChild(fragment);
    
    // make sure focus goes back to the input
    world.terminal.onclick = function() { world.input.focus(); };
    
    // enter key passthrough from WSClient.pressKey
    world.input.onEnter = function(cmd) { world.sendCommand(cmd); };

    // escape key passthrough from WSClient.pressKey
    world.input.onEscape = function () { world.input.clear(); };

    // input key event callbacks. here we show the defaults
    // provided by WSClient.pressKey and WSClient.releaseKey
    // world.input.onKeyDown = function(e) { WSClient.pressKey(this, e); };
    // world.input.onKeyUp = function(e) { WSClient.releaseKey(this, e); };

    // which keys are used for cycling through command history?
    // here we show the default keys, ctrl+p and ctrl+n
    // world.input.keyCycleForward = function(key) { return (key.code === 78 && key.ctrl); }; // ctrl+n
    // world.input.keyCycleBackward = function(key) { return (key.code === 80 && key.ctrl); }; // ctrl+p
    
    container.on('resize', function() { client.world.output.scrollDown(); });
    container.on('destroy', function() { client.world.sendText('QUIT'); client.world.close(); });
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a terminal inside the given root element
  _CLIENT.prototype.initChatWindow = function(container, state) {
    container.setTitle('Chat Window');
    
    var root = document.createElement('div');
    root.className = "terminal";
    container.getElement().append(root);
    
    var world = this.world;
    
    // Chat output window
    world.chatwindow = WSClient.output(document.createElement('div'));
    world.chatwindow.root.className = "terminal-output ansi-37 ansi-40";
    root.appendChild(world.chatwindow.root);
    
    // make sure focus goes back to the input
    root.onclick = function() { world.input.focus(); };
    
    container.on('resize', function() { client.world.chatwindow.scrollDown(); });
    container.on('destroy', function() { client.world.chatwindow = null; client.world.eat_newline = client.world.output; });
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  _CLIENT.prototype.openEditor = function() {
    
  }
  
  _CLIENT.prototype.initEditor = function(container, state) {
    var root = document.createElement('div');
    root.className = "editor";
    container.getElement().append(root);
    
    var world = this.world;
    
    // Build the window in a document fragment
    var fragment = document.createDocumentFragment();
    
    var menu = document.createElement('ul');
    menu.className = "editor-menu";

    var send = document.createElement('li');
    send.className = "editor-send";
    send.innerHTML = "Send";
    menu.appendChild(send);

    fragment.appendChild(menu);

    var wrap = document.createElement('div');
    wrap.className = "editor-wrapper";
    fragment.appendChild(wrap);
    
    var div = document.createElement('div');
    div.className = "editor-content";
    wrap.appendChild(div);
    
    if (world.editor !== null) {
      world.editor.destroy();
      world.editor.container.remove();
      world.editor = null;
    }
    
    world.editor = ace.edit(div);
    world.editor.setTheme("ace/theme/twilight");
    world.editor.session.setMode("ace/mode/mushcode");
    world.editor.session.setUseWrapMode(true);
    
    if (state.hasOwnProperty("text")) {
      world.editor.setValue(state.text);
    }
    
    send.onclick = function() {
      world.sendCommand(world.editor.getValue());
      container.close();
    };
    
    //container.extendState({ editor: editor });

    root.appendChild(fragment);
    
    container.on('destroy', function() {
      world.editor.destroy();
      world.editor.container.remove();
      world.editor = null;
    });
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // connect to the game server
  _CLIENT.prototype.connect = function(host, port, ssl) {
    var layout = this.layout;
    var world = this.world;
    world.serverAddress = host;
    world.serverPort = port;
    world.serverSSL = ssl;

    world.serverProto = world.serverSSL ? "wss://" : "ws://";

    // The connection URL is ws://host:port/wsclient (or wss:// for SSL connections)
    world.serverUrl = world.serverProto + world.serverAddress + ":" + world.serverPort + '/wsclient'
    
    world.close();
    world.conn = WSClient.connect(world.serverUrl);

    // just log a standard message on these socket status events
    world.conn.onOpen = function (evt) { world.output.appendMessage('logMessage', '%% Connected.'); };
    world.conn.onError = function (evt) { world.output.appendMessage('logMessage', '%% Connection error!'); console.log(evt); };
    world.conn.onClose = function (evt) { world.output.appendMessage('logMessage', '%% Connection closed.'); };

    // handle incoming text, html, pueblo, or command prompts
    world.conn.onText = function (text) {
      var re_fugueedit = /^FugueEdit > /;
      if (text.match(re_fugueedit)) {
        var str = text.replace(re_fugueedit, "");
        if (world.editor === null) {
          var editor = { type: "component", componentName: "Editor", componentState: { text: str } };
          layout.root.contentItems[0].addChild(editor);
        } else {
          world.editor.setValue(str);
        }
      } else if (world.eat_newline && (text === "\r\n" || text === '\r' || text === '\n' || text === '\n\r')) {
        world.eat_newline.appendText(text);
        world.eat_newline = world.output;
      } else if (world.chatwindow && (text.substring(0,5) === 'CHAT:' || text[0] === '<')) {
          world.chatwindow.appendText(text);
          world.eat_newline = world.chatwindow;
      } else {
        world.output.appendText(text);
      }
    };
    
    world.conn.onHTML = function (fragment) { world.output.appendHTML(fragment); };
    world.conn.onPueblo = function (tag, attrs) { world.output.appendPueblo(tag, attrs); };
    world.conn.onPrompt = function (text) { world.prompt.clear(); world.prompt.appendText(text + '\r\n'); };

    // handle incoming JSON objects. requires server specific implementation
    world.conn.onObject = function (obj) {
      console.dir(obj);
      if (obj.hasOwnProperty('_layout')) {
        // open a new window with the given obj as config
        obj._layout.type = 'component';
        if (obj._layout.componentName === 'ChatWindow' && world.chatwindow) { return; }
        layout.root.contentItems[0].addChild(obj._layout);
      }
    };
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////

  function _WORLD() {
    // The container
    this.terminal = null;
    
    // Server connection info
    this.serverAddress = null;
    this.serverPort = null;
    this.serverSSL = null;
    this.serverProto = null;
    this.serverUrl = null;
    this.conn = null;
    
    // Terminal UI elements
    this.output = null;
    this.quicklinks = null;
    this.prompt = null;
    this.input = null;
    
    // Chat Window
    this.chatwindow = null;
    this.eat_newline = null;
    
    // Code Editor
    this.editor = null;
  }
  
  _WORLD.prototype.reconnect = function() {
    this.conn && this.conn.reconnect();
  };
  
  _WORLD.prototype.isConnected = function () {
    return (this.conn && this.conn.isConnected());
  };
  
  _WORLD.prototype.close = function () {
    this.conn && this.conn.close();
  };
  
  _WORLD.prototype.sendText = function (data) {
    this.conn && this.conn.sendText(data);
  };
  
  _WORLD.prototype.appendMessage = function(classid, msg) {
    this.output && this.output.appendMessage(classid, msg);
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////

  // function to send a command string to the server
  _WORLD.prototype.sendCommand = function(cmd) {
    if (this.isConnected()) {
      if (cmd !== '') {
        this.sendText(cmd);
        this.appendMessage('localEcho', cmd);
      }
    } else { // connection was broken, let's reconnect
      this.reconnect();
      this.appendMessage('logMessage', '%% Reconnecting to server...');
    }
  };

  // pueblo command links, prompt for user input and replace ?? token if present
  _WORLD.prototype.onCommand = function(cmd) {
    this.sendCommand(WSClient.parseCommand(cmd));
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  // add a command link to the quicklinks bar
  // cmd can be a string to send, or a function to run
  _WORLD.prototype.addQuickLink = function(label, cmd) {
    var world = this;
    var link = document.createElement('a');
    var text = document.createTextNode(label);
    link.appendChild(text);
    
    if (typeof(cmd) === "function") {
      link.title = "Command: " + label;
      link.onclick = function () { cmd && cmd(); };
    } else {
      link.title = "Command: " + cmd;
      link.onclick = function () { world.onCommand && world.onCommand(cmd); };
    }
    
    if (this.quicklinks.childElementCount > 0) {
      this.quicklinks.appendChild(document.createTextNode(' | '));
    }
    
    this.quicklinks.appendChild(link);
    return link;
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  var exports = {};
  
  exports.create = function() {
    return new _CLIENT();
  };
  
  return exports;

})(window, document);
