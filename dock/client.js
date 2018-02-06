var Client = (function (window, document, undefined) {

  function _CLIENT() {
    this.root = null;
    this.world = new _WORLD();
    this.layout = null;
    this.savedState = null;
  }
  
  _CLIENT.baseConfig = {
    settings: {
      showPopoutIcon: false
    },
    content: [{
      type: 'row',
      content: [{
        type: 'component',
        isClosable: false,
        componentName: 'Terminal',
        componentState: { },
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

    var game = this;
    game.root = root;
    
    game.savedState = localStorage.getItem('savedState');
    if (game.savedState !== null) {
      game.layout = new GoldenLayout(JSON.parse(game.savedState), game.root);
    } else {
      game.layout = new GoldenLayout(_CLIENT.baseConfig, game.root);
    }
    
    // Main terminal window
    game.layout.registerComponent('Terminal', function(container, state) {
      var div = document.createElement('div');
      div.className = "terminal";
      game.initTerminal(div);
      container.getElement().append(div);
      
      container.on('resize', function() { game.world.output.scrollDown(); });
      container.on('destroy', function() { game.world.sendText('QUIT'); game.world.close(); });
    });
    
    // External chat window for <Channels>
    game.layout.registerComponent('ChatWindow', function(container, state) {
      var div = document.createElement('div');
      div.className = "terminal";
      game.initChatWindow(div);
      container.getElement().append(div);
      
      container.on('resize', function() { game.world.chatwindow.scrollDown(); });
      container.on('destroy', function() { game.world.chatwindow = null; game.world.eat_newline = game.world.output; });
    });

    // Generic popup window
    game.layout.registerComponent('Window', function(container, state) {
      var div = document.createElement('div');
      div.className = "window";
      container.getElement().append(div);
    });
    
    // actually start the window manager
    game.layout.init();
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a terminal inside the given root element
  _CLIENT.prototype.initTerminal = function(root) {
    if (!root) {
      return null;
    }
    
    var world = this.world;
    world.terminal = root;
    
    // Build the terminal window in a document fragment
    var fragment = document.createDocumentFragment();
    
    // Output window
    world.output = WSClient.output(document.createElement('div'));
    world.output.root.className = "output ansi-37 ansi-40";
    fragment.appendChild(world.output.root);
    
    // Quicklinks bar
    world.quicklinks = document.createElement('div');
    world.quicklinks.className = "quicklinks ansi-37 ansi-40";
    fragment.appendChild(world.quicklinks);
    
    world.addQuickLink('WHO', 'who');
    world.addQuickLink('LOOK', 'look');
    world.addQuickLink('INVENTORY', 'inventory');
    world.addQuickLink('@MAIL', '@mail');
    world.addQuickLink('+BB', '+bb');
    world.addQuickLink('CLEAR', function() { world.output.clear(); world.prompt.clear(); world.input.clear(); });
    
    // Prompt window
    world.prompt = WSClient.output(document.createElement('div'));
    world.prompt.root.className = "prompt ansi-37 ansi-40";
    fragment.appendChild(world.prompt.root);
    
    // Input window
    world.input = WSClient.input(document.createElement('textarea'));
    world.input.root.className = "input";
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
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a terminal inside the given root element
  _CLIENT.prototype.initChatWindow = function(root) {
    var world = this.world;
    
    if (!root) {
      return null;
    }
    
    // Build the terminal window in a document fragment
    var fragment = document.createDocumentFragment();
    
    // Chat output window
    world.chatwindow = WSClient.output(document.createElement('div'));
    world.chatwindow.root.className = "output ansi-37 ansi-40";
    fragment.appendChild(world.chatwindow.root);
    
    // Chat Input window
    var input = WSClient.input(document.createElement('textarea'));
    input.root.className = "input";
    input.root.setAttribute('autocomplete', 'off');
    input.root.setAttribute('autofocus', '');
    fragment.appendChild(input.root);
    
    // Add our terminal components to the container
    root.appendChild(fragment);
    
    // make sure focus goes back to the input
    root.onclick = function() { input.focus(); };
    
    // enter key passthrough from WSClient.pressKey
    input.onEnter = function(cmd) { world.sendText(cmd); world.chatwindow.appendMessage('localEcho', cmd); };

    // escape key passthrough from WSClient.pressKey
    input.onEscape = function () { input.clear(); };

    // input key event callbacks. here we show the defaults
    // provided by WSClient.pressKey and WSClient.releaseKey
    // world.input.onKeyDown = function(e) { WSClient.pressKey(this, e); };
    // world.input.onKeyUp = function(e) { WSClient.releaseKey(this, e); };

    // which keys are used for cycling through command history?
    // here we show the default keys, ctrl+p and ctrl+n
    // world.input.keyCycleForward = function(key) { return (key.code === 78 && key.ctrl); }; // ctrl+n
    // world.input.keyCycleBackward = function(key) { return (key.code === 80 && key.ctrl); }; // ctrl+p
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////

  // connect to the game server
  _CLIENT.prototype.connect = function(host, port, ssl) {
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
      if (world.eat_newline && (text === "\r\n" || text === '\r' || text === '\n' || text === '\n\r')) {
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
      if (obj.hasOwnProperty('windowConfig')) {
        // open a new window with the given config
      }
    };

    // pueblo command links, prompt for user input and replace ?? token if present
    world.onCommand = function(cmd) { world.sendCommand(WSClient.parseCommand(cmd)); };
    world.output.onCommand = world.onCommand;

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
