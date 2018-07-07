var Client = (function (window, document, undefined) {

  function _CLIENT(root) {
    this.root = root;
    this.world = new _WORLD(this);
    
    // Terminal UI elements
    this.terminal = null;
    this.output = null;
    this.quicklinks = null;
    this.prompt = null;
    this.input = null;
    
    // Sidebar UI elements
    this.sidebar = null;
    this.navbar = null;
    this.feed = null;
    
    this.initSidebar();
    this.initTerminal();
  }
  
  // pueblo command links, prompt for user input and replace ?? token if present
  _CLIENT.prototype.onCommand = function(cmd) {
    this.world && this.world.sendCommand(WSClient.parseCommand(cmd));
  };

  // log messages to the output terminal
  _CLIENT.prototype.appendMessage = function(classid, msg) {
    this.output && this.output.appendMessage(classid, msg);
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a terminal inside the given root element
  _CLIENT.prototype.initTerminal = function() {
    var root = document.createElement('div');
    root.className = "terminal";
    this.root.append(root);
    
    var client = this;
    client.terminal = root;
    
    // Build the terminal window in a document fragment
    var fragment = document.createDocumentFragment();
    
    // Output window
    client.output = WSClient.output(document.createElement('div'));
    client.output.root.className = "output ansi-37 ansi-40";
    client.output.onCommand = function(cmd) { client.onCommand(cmd); };
    fragment.appendChild(client.output.root);
    
    // Quicklinks bar
    client.quicklinks = document.createElement('div');
    client.quicklinks.className = "quicklinks ansi-37 ansi-40";
    fragment.appendChild(client.quicklinks);
    
    client.addQuickLink('WHO', 'who');
    client.addQuickLink('LOOK', 'look');
    client.addQuickLink('INVENTORY', 'inventory');
    client.addQuickLink('@MAIL', '@mail');
    client.addQuickLink('+BB', '+bb');
    client.addQuickLink('CLEAR', function() { client.output.clear(); client.prompt.clear(); client.input.clear(); });
    
    // Prompt window
    client.prompt = WSClient.output(document.createElement('div'));
    client.prompt.root.className = "prompt ansi-37 ansi-40";
    fragment.appendChild(client.prompt.root);
    
    // Input window
    client.input = WSClient.input(document.createElement('textarea'));
    client.input.root.className = "input";
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

    root.onresize = function() { client.output.scrollDown(); };
    root.onunload = function() { client.world.sendText('QUIT'); client.world.close(); };
    
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

  // add a command link to the quicklinks bar
  // cmd can be a string to send, or a function to run
  _CLIENT.prototype.addNavLink = function(label, cmd) {
    var client = this;
    var link = document.createElement('li');
    link.innerHTML = label;
    
    if (typeof(cmd) === "function") {
      link.title = label;
      link.onclick = function () { cmd && cmd(); };
    } else {
      link.title = "Command: " + cmd;
      link.onclick = function () { client.onCommand && client.onCommand(cmd); };
    }
    
    client.navbar.appendChild(link);
    return link;
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////

  // construct a sidebar inside the root element
  _CLIENT.prototype.initSidebar = function() {
    var client = this;
    var root = document.createElement('div');
    root.className = "sidebar";
    client.root.append(root);
    
    client.sidebar = root;
    
    // Navbar
    client.navbar = document.createElement('ul');
    client.navbar.className = "navbar";
    client.sidebar.append(client.navbar);
    
    client.addNavLink("Settings", function() { console.log("Settings!"); });
    
    // Feed
    client.feed = document.createElement('div');
    client.feed.className = "feed";
    client.sidebar.append(client.feed);

  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////

  // animate scrolling the terminal window to the bottom
  _CLIENT.prototype.scrollFeed = function() {
    // TODO: May want to animate this, to make it less abrupt.
    //this.root.scrollTop = this.root.scrollHeight;
    //return;
    
    var root = this.feed;   
    var scrollCount = 0;
    var scrollDuration = 500.0;
    var oldTimestamp = performance.now();

    function step (newTimestamp) {
      var bottom = root.scrollHeight - root.clientHeight;
      var delta = (bottom - root.scrollTop) / 2.0;

      scrollCount += Math.PI / (scrollDuration / (newTimestamp - oldTimestamp));
      if (scrollCount >= Math.PI) root.scrollTo(0, bottom);
      if (root.scrollTop === bottom) { return; }
      root.scrollTo(0, Math.round(root.scrollTop + delta));
      oldTimestamp = newTimestamp;
      window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  };
  
  /////////////////////////////////////////////////////////////////////////////////////////////////

  // connect to the game server
  _CLIENT.prototype.connect = function(host, port, ssl) {
    var client = this;
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
        client.input.root.value = str;
      } else {
        client.output.appendText(text);
      }
    };
    
    world.conn.onHTML = function (fragment) { client.output.appendHTML(fragment); };
    world.conn.onPueblo = function (tag, attrs) { client.output.appendPueblo(tag, attrs); };
    world.conn.onPrompt = function (text) { client.prompt.clear(); client.prompt.appendText(text + '\r\n'); };

    // handle incoming JSON objects. requires server specific implementation
    world.conn.onObject = function (obj) {
      if (obj.hasOwnProperty('datacron')) {
        var div = document.createElement('div');
        div.className = "datacron";
        var label = document.createElement('h2');
        var text = document.createTextNode(obj.data);
        label.innerHTML = obj.datacron;
        div.append(label);
        div.append(text);
        
        client.feed.append(div);
        client.scrollFeed();
      }
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
  
  // return a new copy of the client
  var exports = {};
  exports.create = function(root) {
    return new _CLIENT(root);
  }
  
  return exports;

})(window, document);
