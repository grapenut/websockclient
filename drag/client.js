var Client = (function (window, document, undefined) {

  function _CLIENT(root) {
    this.root = $(root);
    this.world = new _WORLD(this);
    
    // Terminal UI elements
    this.terminal = null;
    this.output = null;
    this.quicklinks = null;
    this.prompt = null;
    this.input = null;
    
    // Chat Window
    this.chatpanel = null;
    this.chatoutput = null;
    this.eat_newline = null;
    
    // Code Editor
    this.editor = null;

    // The stack of panels
    this.panels = [];
    
    this.initTerminal();
  }
  
  // pueblo command links, prompt for user input and replace ?? token if present
  _CLIENT.prototype.onCommand = function(cmd) {
    this.world && this.world.sendCommand(WSClient.parseCommand(cmd));
  };

  _CLIENT.prototype.appendMessage = function(classid, msg) {
    this.output && this.output.appendMessage(classid, msg);
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a terminal inside the given root element
  _CLIENT.prototype.initTerminal = function() {
    var root = $(document.createElement('div'));
    root.addClass("terminal");
    this.root.append(root);
    
    var client = this;
    client.terminal = root;
    
    // Build the terminal window in a document fragment
    var fragment = document.createDocumentFragment();
    
    // Output window
    client.output = WSClient.output(document.createElement('div'));
    client.output.root.className = "terminal-output ansi-37 ansi-40";
    client.output.onCommand = function(cmd) { client.onCommand(cmd); };
    fragment.appendChild(client.output.root);
    
    // Quicklinks bar
    client.quicklinks = document.createElement('div');
    client.quicklinks.className = "terminal-quicklinks ansi-37 ansi-40";
    fragment.appendChild(client.quicklinks);
    
    client.addQuickLink('WHO', 'who');
    client.addQuickLink('LOOK', 'look');
    client.addQuickLink('INVENTORY', 'inventory');
    client.addQuickLink('@MAIL', '@mail');
    client.addQuickLink('+BB', '+bb');
    client.addQuickLink('CLEAR', function() { client.output.clear(); client.prompt.clear(); client.input.clear(); });
    
    // Prompt window
    client.prompt = WSClient.output(document.createElement('div'));
    client.prompt.root.className = "terminal-prompt ansi-37 ansi-40";
    fragment.appendChild(client.prompt.root);
    
    // Input window
    client.input = WSClient.input(document.createElement('textarea'));
    client.input.root.className = "terminal-input";
    client.input.root.setAttribute('autocomplete', 'off');
    client.input.root.setAttribute('autofocus', '');
    fragment.appendChild(client.input.root);
    
    // Add our terminal components to the container
    client.terminal.append(fragment);
    
    // make sure focus goes back to the input
    client.terminal.onclick = function() { client.input.focus(); };
    
    // enter key passthrough from WSClient.pressKey
    client.input.onEnter = function(cmd) { client.world.sendCommand(cmd); };

    // escape key passthrough from WSClient.pressKey
    client.input.onEscape = function () { client.input.clear(); };

    root.resize(function() { client.output.scrollDown(); });
    root.unload(function() { client.world.sendText('QUIT'); client.world.close(); });
    
    root.draggable();
    root.resizable();
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  // add a command link to the quicklinks bar
  // cmd can be a string to send, or a function to run
  _CLIENT.prototype.addQuickLink = function(label, cmd) {
    var client = this;
    var link = document.createElement('a');
    var text = document.createTextNode(label);
    link.appendChild(text);
    
    if (typeof(cmd) === "function") {
      link.title = "Command: " + label;
      link.onclick = function () { cmd && cmd(); };
    } else {
      link.title = "Command: " + cmd;
      link.onclick = function () { client.onCommand && client.onCommand(cmd); };
    }
    
    if (client.quicklinks.childElementCount > 0) {
      client.quicklinks.appendChild(document.createTextNode(' | '));
    }
    
    client.quicklinks.appendChild(link);
    return link;
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a chat window inside the given root element
  _CLIENT.prototype.initChatWindow = function() {
    var root = $(document.createElement('div'));
    root.addClass("terminal");
    this.root.append(root);
    
    var world = this.world;
    client.chatpanel = root;
    
    // Chat output window
    client.chatoutput = WSClient.output(document.createElement('div'));
    client.chatoutput.root.className = "terminal-output ansi-37 ansi-40";
    client.chatpanel.append(client.chatoutput.root);
    
    // make sure focus goes back to the input
    root.onclick = function() { client.input.focus(); };
    
    root.resize(function() { client.chatoutput.scrollDown(); });
    root.unload(function() { client.chatoutput = null; client.eat_newline = client.output; });
    
    root.draggable();
    root.resizable();
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  _CLIENT.prototype.openEditor = function() {
    
  }
  
  _CLIENT.prototype.initEditor = function() {
    var root = $(document.createElement('div'));
    root.addClass("editor");
    this.root.append(root);
    
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
    
    client.editor = ace.edit(div);
    client.editor.setTheme("ace/theme/twilight");
    client.editor.session.setMode("ace/mode/mushcode");
    client.editor.session.setUseWrapMode(true);
    
    if (state.hasOwnProperty("text")) {
      client.editor.setValue(state.text);
    }
    
    send.onclick = function() {
      client.sendCommand(client.editor.getValue());
    };
    
    root.appendChild(fragment);
    
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
    world.conn.onOpen = function (evt) { client.appendMessage('logMessage', '%% Connected.'); };
    world.conn.onError = function (evt) { client.appendMessage('logMessage', '%% Connection error!'); console.log(evt); };
    world.conn.onClose = function (evt) { client.appendMessage('logMessage', '%% Connection closed.'); };

    // handle incoming text, html, pueblo, or command prompts
    world.conn.onText = function (text) {
      var re_fugueedit = /^FugueEdit > /;
      if (text.match(re_fugueedit)) {
        var str = text.replace(re_fugueedit, "");
        if (client.editor === null) {
          client.initEditor()
        } else {
          client.editor.setValue(str);
        }
      } else if (client.eat_newline && (text === "\r\n" || text === '\r' || text === '\n' || text === '\n\r')) {
        client.eat_newline.appendText(text);
        client.eat_newline = client.output;
      } else if (client.chatoutput && (text.substring(0,5) === 'CHAT:' || text[0] === '<')) {
          client.chatoutput.appendText(text);
          client.eat_newline = client.chatoutput;
      } else {
        client.output.appendText(text);
      }
    };
    
    world.conn.onHTML = function (fragment) { client.output.appendHTML(fragment); };
    world.conn.onPueblo = function (tag, attrs) { client.output.appendPueblo(tag, attrs); };
    world.conn.onPrompt = function (text) { client.prompt.clear(); client.prompt.appendText(text + '\r\n'); };

    // handle incoming JSON objects. requires server specific implementation
    world.conn.onObject = function (obj) {
      console.dir(obj);
    };
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////

  function _WORLD(root) {
    // The container
    this.client = root;
    
    // Server connection info
    this.serverAddress = null;
    this.serverPort = null;
    this.serverSSL = null;
    this.serverProto = null;
    this.serverUrl = null;
    this.conn = null;
    
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
    this.client && this.client.appendMessage(classid, msg);
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
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////////////////////////////////////////////////////////////
  
  var exports = {};
  
  exports.create = function(root) {
    return new _CLIENT(root);
  };
  
  return exports;

})(window, document);
