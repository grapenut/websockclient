// A Simple WSClient for PennMUSH
// -grapenut

var defaultHost = window.location.hostname;
var defaultPort = '4201';

// pre-define the connection object, later it will be set to
// conn = WSClient.open('ws://host:port/wsclient')
var conn = null;

// user information
var login = document.getElementById('login');
var username = document.getElementById('username');
var password = document.getElementById('password');

// terminal is the container for output, cmdprompt, quicklinks and the entry box.
var terminal = document.getElementById('terminal');

// the main terminal output window
var output = WSClient.output(document.getElementById('output'));

// update the command prompt without modifying the main output
var cmdprompt = WSClient.output(document.getElementById('prompt'));

// clickable command links that do some common tasks (who, look, @mail, etc)
var quicklinks = document.getElementById('quicklinks');

// the user input box
var entry = WSClient.input(document.getElementById('entry'));

// settings popup and the different configuration options
var settingsContainer = document.getElementById('settings-container');
var settingsForm = document.getElementById('settings');
var fontSelect = document.getElementById('fontSelect');
var fontSize = document.getElementById('fontSize');
var fontBold = document.getElementById('fontBold');
var forceSSL = document.getElementById('forceSSL');
var keepAliveTime = document.getElementById('keepAliveTime');
var keepAliveLabel = document.getElementById('keepAliveLabel');

// info window (show the credits)
var infoContainer = document.getElementById('info-container');



/***********************************************/
/**  Body  **/

// called by body.onLoad
function startup() {
  // load browser cookie and parse settings
  settings.load();

  // set the initial screen dimensions (use for multi-window output)
  terminal.style.left = settings.SCREEN_LEFT + 'em';
  terminal.style.right = settings.SCREEN_RIGHT + 'em';

  terminal.style.top = settings.SCREEN_TOP + 'em';
  terminal.style.bottom = settings.SCREEN_BOT + 'em';

  // set some obvious ChangeMe values if there are none saved
  if (username.value === '') {
    username.value = 'Username';
  }

  if (password.value === '') {
    password.value = 'Password';
  }

  // autoconnect, if desired
  settings.autoConnect.val && reconnect();

  // start the keepalive loop
  keepalive();

  // set focus on the input box
  refocus();
};



// called by body.onUnload
function shutdown() {
  // if we have an active connection, 
  // send a QUIT command and exit gracefully
  if (conn && conn.socket.readyState === 1) {
    conn.sendText('QUIT');
    setTimeout(conn.close, 1000);
  }

  conn = null;
};



/***********************************************/
/**  Callbacks  **/

// (re)connect to the MUSH when the login button is pushed
login.onsubmit = function() {
  reconnect();

  return false;
};



// the user pressed enter
entry.onEnter = function() {
  // detect whether we have an overlay showing and close it
  if (settingsContainer.style.visibility === 'visible') {
    settings.save();
  } else if (infoContainer.style.visibility === 'visible') {
    infoContainer.style.visibility = 'hidden';
  } else {
    // no overlay, submit user input
    if (conn && conn.socket.readyState === 1) {
      // send current user input to the MUSH
      conn.sendText(entry.value());

      // and echo to the terminal
      settings.localEcho.val && msg(entry.value());
    } else {
      // auto-reconnect if the connection was lost
      settings.autoReConnect.val && reconnect();
    }
  }
};



// the user pressed escape
entry.onEscape = function() {
  toggle_overlays();
};



settingsForm.onsubmit = function () {
  settings.save();

  entry.focus();

  return false;
};



settingsForm.onkeydown = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if (code == 27) {
    // escape pressed, toggle form input and delete command elements
    toggle_overlay();
  }

};



// automatically update port +/- 1 when forceSSL is changed
// 4201 -> 4202 with ssl
// this maybe is a bit awkward, but I didn't come up with a better idea
forceSSL.onchange = function() {
  if (forceSSL.checked) {
    serverPort.value = parseInt(serverPort.value) + 1;
  } else {
    serverPort.value = parseInt(serverPort.value) - 1;
  }
};



// close the info window on any key press
infoContainer.onkeydown = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  toggle_overlay();
};



/***********************************************/
/**  Focus  **/

// put focus back on the user input box
// unless it's in another input box (e.g. username/password/settings)
function refocus() {
  if (((window.getSelection == "undefined") ||
       (window.getSelection() == "")) &&
      ((document.getSelection == "undefined") ||
       (document.getSelection() == "")) &&
     !((document.activeElement.tagName === "INPUT") &&
       (document.activeElement.type.search(/image/gi) === -1)))
  {
    entry.focus();
  }
};



// move the input cursor to the end of the input elements current text
function move_cursor_to_end(el) {
  if (typeof el.selectionStart == "number") {
      el.selectionStart = el.selectionEnd = el.value.length;
  } else if (typeof el.createTextRange != "undefined") {
      el.focus();
      var range = el.createTextRange();
      range.collapse(false);
      range.select();
  }
};



// close anything that may be showing or bring up the settings
function toggle_overlay() {
  if (settingsContainer.style.visibility === 'visible') {
    settings.show();
    settings.reconfigure();
  } else if (infoContainer.style.visibility === 'visible') {
    infoContainer.style.visibility = 'hidden';
  } else {
    // no overlay, bring up settings
    settings.show();
  }

  entry.focus();
};



/***********************************************/
/**  Terminal  **/

// send a log message to the terminal output
function msg(data) {
  output.appendMessage('logMessage', data);
};



function xch_cmd(command) {
  output.onCommand(command);
};

// execute pueblo command
// a '??' token in command will be replaced with user input
output.onCommand = function (command) {
  var cmd = WSClient.parseCommand(command);
  
  // send the parsed command to the MUSH
  conn && conn.sendText(cmd);
  settings.localEcho.val && msg(cmd);
};



// clear the child elements from any element (like the output window)
function clearscreen () {
  output.clear();
  cmdprompt.clear();
  entry.clear();
};



// keepalive function continually calls itself and sends the IDLE command
function keepalive () {
  conn && settings.keepAlive.val && conn.sendText("IDLE");
  setTimeout(keepalive, settings.keepAliveTime.val*1000.0);
};



// connect or reconnect to the MUSH
function reconnect() {

  // we can't do websockets, redirect to 505
  if (!window.WebSocket){
    window.location.replace("/505.htm");
  }

  entry.focus();

  // clean up the old connection gracefully
  if (conn) {
    var old = conn;
    old.sendText('QUIT');
    setTimeout(function () { old.close(); }, 1000);
    conn = null;
  }

  msg('%% Reconnecting to server...\r\n');

  // detect whether to use SSL or not
  var proto = ((window.location.protocol == "https:") || settings.forceSSL.val) ? 'wss://' : 'ws://';

  // open a new connection to ws://host:port/wsclient
  conn = WSClient.open(proto + settings.serverAddress.val + ":" + settings.serverPort.val + '/wsclient');
  
  // auto-login if username and password are not the default values
  conn.onOpen = function (text) {
    msg("%% Connected.");
    if (username.value.toUpperCase() !== "USERNAME" && username.value !== "") {
      setTimeout(function () {
        conn.sendText('connect "' + username.value + '" ' + password.value);
      }, 4000);
    }
  };



  // send a log message if there is a connection error
  conn.onError = function (evt) {
    msg("%% Connection error!");
    console.log('error', evt);
  };



  // send a log message when connection closed
  conn.onClose = function (evt) {
    msg("%% Connection closed.");
    console.log('close', evt);
  };



  // handle incoming plain text
  // this will parse ansi color codes, but won't render untrusted HTML
  conn.onText = function (text) {
    var reg = /^FugueEdit > /;
    
    // detect if we are capturing a FugueEdit string
    if (text.search(reg) !== -1) {
      // replace the user input with text, sans the FugueEdit bit
      entry.value = text.replace(reg, "");
    } else {
      // append text to the output window
      output.appendText(text);
    }
  };


  
  // handle incoming JSON object
  conn.onObject = function (obj) {
    // just send a log message
    // could use this for lots of neat stuff
    // maps, huds, combat logs in a separate window
    console.log('object', obj);
  };


  
  // handle incoming HTML from the MUSH
  // it's already been encoded and trusted by the MUSH
  conn.onHTML = function (fragment) {
    // just append it to the terminal output
    output.appendHTML(fragment);
  };


  
  // handle incoming pueblo tags
  // currently implements xch_cmd and xch_hint
  conn.onPueblo = function (tag, attrs) {
    // just append it to the terminal output
    output.appendPueblo(tag, attrs);
  };



  // handle incoming command prompt
  conn.onPrompt = function (text) {
    // replace anything in cmdprompt with text
    // cmdprompt is an emulated terminal, so use appendText() to get ansi parsed
    cmdprompt.root.innerHTML = '';
    cmdprompt.appendText(text + '\r\n');
  };


};



/***********************************************/
/**  Settings  **/

var SettingsClass = (function (window, document, undefined) {

  this.localEcho = {val: true};
  this.autoConnect = {val: true};
  this.autoReConnect = {val: true};
  this.numInputLines = {val: 3};
  this.serverAddress = {val: defaultHost};
  this.serverPort = {val: defaultPort};
  this.forceSSL = {val: false};
  this.keepAlive = {val: true};
  this.keepAliveTime = {val: 600};
  this.fontSelect = {val: "Courier New"};
  this.fontSize = {val: 10};
  this.fontBold = {val: false};

  this.SCREEN_TOP = 3;
  this.SCREEN_BOT = 3;
  this.SCREEN_LEFT = 3;
  this.SCREEN_RIGHT = 3;

  this.doc = document;
  
  settingsContainer.style.visibility = 'hidden';
  
  /////////////////////////////////////

  this.updateFonts = function() {
    document.body.style.fontFamily = fontSelect.value + ", 'Courier New', monospace";
    document.body.style.fontSize = fontSize.value + 'pt';
    document.body.style.fontWeight = (fontBold.checked ? "bold" : "normal");;
    keepAliveLabel.innerHTML='KeepAlive('+keepAliveTime.value+'s)';
  };



  this.show = function () {
    if (settingsContainer.style.visibility === 'visible') {
      settingsContainer.style.visibility = 'hidden';
      this.reconfigure();
    } else {
      // restore form values from actual settings
      var opts = document.getElementsByClassName('option');
      for (var i=0; i < opts.length; i++)
      {
        var opt = this[opts[i].id];
        if (opt) {
          if (opts[i].type.toUpperCase() === 'CHECKBOX') {
            opts[i].checked = opt.val;
          } else {
            opts[i].value = opt.val;
          }
        }
        
      }
      settingsContainer.style.visibility = 'visible';
    }
  };



  this.cookie = function (c_name) {
    var c_value = this.doc.cookie;
    var c_start = c_value.indexOf(" " + c_name + "=");

    if (c_start == -1)
    {
      c_start = c_value.indexOf(c_name + "=");
    }

    if (c_start == -1) {
      c_value = null;
    } else {
      c_start = c_value.indexOf("=", c_start) + 1;

      var c_end = c_value.indexOf(";", c_start);
    
      if (c_end == -1) {
        c_end = c_value.length;
      }
    
      c_value = unescape(c_value.substring(c_start,c_end));
    }
  
    return c_value;
  };



  // Load values from cookies, or save the cookie on first visitl
  this.load = function () {
    var opts = document.getElementsByClassName('option');
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + 365*10);
    
    for (var i = 0; i < opts.length; i++)
    {
      var opt = this[opts[i].id];
      
      if (opt) {
        if (opts[i].type.toUpperCase() === 'CHECKBOX') {
          var val = this.cookie(opts[i].id);
          if (val && val != 'undefined') {
            opt.val = (val.toUpperCase() === 'TRUE');
          } else {
            this.doc.cookie = opts[i].id + "=" + opt.val
          }
          
          opts[i].checked = opt.val;
        } else {
          var val = this.cookie(opts[i].id);
          if (val && val != 'undefined') {
            opt.val = val;
          } else {
            this.doc.cookie = opts[i].id + "=" + opt.val
          }
          
          opts[i].value = opt.val;
        }
      }
    }
    
    this.reconfigure();
  };


  
  // Save form values to settings values, and settings values to cookies
  this.save = function () {
    var opts = document.getElementsByClassName('option');
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + 365*10);
    
    for (var i = 0; i < opts.length; i++)
    {
      var opt = this[opts[i].id];
      
      // copy form values to settings values
      if (opt) {
        if (opts[i].type.toUpperCase() === 'CHECKBOX') {
          if (opts[i].checked !== opt.val) {
            opt.val = opts[i].checked;
          }
        } else {
          if (opts[i].value !== opt.val) {
            opt.val = opts[i].value;
          }
        }
        
        // save settings value to cookie
        this.doc.cookie=opts[i].id + "=" + opt.val + "; expires="+exdate.toUTCString();
      }
    }
    
    this.reconfigure();
    
    // toggle visibility
    settingsContainer.style.visibility = 'hidden';
  };



  // Resize or otherwise modify the output window to reflect the new settings
  this.reconfigure = function() {
    document.body.style.fontFamily = this.fontSelect.val + ", 'Courier New', monospace";
    document.body.style.fontSize = this.fontSize.val + 'pt';
    document.body.style.fontWeight = (this.fontBold.val ? "bold" : "normal");;
    output.root.style.bottom = 4.0+parseInt(this.numInputLines.val) + 'em';
    quicklinks.style.bottom = 2.0+parseInt(this.numInputLines.val) + 'em';
    cmdprompt.root.style.bottom = 1.0+parseInt(this.numInputLines.val) + 'em';
    entry.root.style.height = parseInt(this.numInputLines.val) + 'em';
    keepAliveLabel.innerHTML='KeepAlive('+keepAliveTime.value+'s)';
  };



});

var settings = new SettingsClass(window,document,undefined);
