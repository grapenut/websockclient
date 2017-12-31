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
var output = WSClient.emulate(document.getElementById('output'));

// update the command prompt without modifying the main output
var cmdprompt = WSClient.emulate(document.getElementById('prompt'));

// clickable command links that do some common tasks (who, look, @mail, etc)
var quicklinks = document.getElementById('quicklinks');

// the user input box
var entry = document.getElementById('entry');

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

// user input command history
var history = [];
var ncommand = 0;
var save_current = '';
var current = -1;



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
terminal.onsubmit = function() {
  if (conn && conn.socket.readyState === 1) {
    if (entry.value !== '') {
      // save command history
      history[ncommand] = entry.value;
      ncommand++;
      save_current = '';
      current = -1;

      // send current user input to the MUSH
      conn.sendText(entry.value);
      // and echo to the terminal
      settings.localEcho.val && msg(entry.value);
    }
  } else {
    // auto-reconnect if the connection was lost
    settings.autoReConnect.val && reconnect();
  }

  // clear the user input and make sure it keeps focus
  entry.value = '';
  entry.focus();

  return false;
};



// capture keypresses and implement special command functions
entry.onkeydown = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if ((code == 80 && e.ctrlKey)) {
    // ctrl+p
    
    // let's prevent printing
    e.preventDefault();

    // keep the current entry in case they come back to it
    if (current < 0) {
      save_current = entry.value;
    }
    
    // cycle command history back
    if (current < ncommand - 1) {
      current++;
      entry.value = history[ncommand-current-1];
    }

  } else if ((code == 78 && e.ctrlKey)) {
    // ctrl+n
    
    // cycle command history forward
    if (current > 0) {
      current--;
      entry.value = history[ncommand-current-1];
    } else if (current === 0) {
      // recall the current entry if they had typed something already
      current = -1;
      entry.value = save_current;
    }

  } else if (code == 13) {
    // enter key
    
    // prevent the default action of submitting forms, etc
    e.preventDefault();
    
    // detect whether we have an overlay showing and close it
    if (settingsContainer.style.visibility === 'visible') {
      settings.save();
    } else if (infoContainer.style.visibility === 'visible') {
      infoContainer.style.visibility = 'hidden';
    } else {
      // no overlay, submit user input
      terminal.onsubmit();
    }

    // make sure we keep focus on the input box
    entry.focus();

  } else if (code == 27) {
    // escape key
    
    // close overlays, or recall the settings box if no overlay is present
    toggle_overlay();
  }
};



// capture key releases
entry.onkeyup = function(e) {
  var code = (e.keyCode ? e.keyCode : e.which);

  if ((code == 80 && e.ctrlKey)) {
    // ctrl+p
    
    // move the cursor to end of the input text after a history change
    // only needed for going up, since ctrl+n moves cursor already
    move_cursor_to_end(entry);
  }
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
  var text = document.createElement('div');
  text.className = "logMessage";
  text.innerHTML = data;
  output.appendHTML(text);
};



// execute pueblo command
// a '??' token in command will be replaced with user input
function xch_cmd(command) {
  var cmd = command;
  var regex = /\?\?/;
  
  // detect if user input is required by finding '??'
  if (cmd.search(regex) !== -1) {
    var val = prompt(command);
    
    // replace '??' with the value input by the user
    if (val && val != 'undefined') {
      cmd = cmd.replace(regex, val);
    } else {
      cmd = cmd.replace(regex, '');
    }
  }
  
  // send the (modified) command to the MUSH
  conn && conn.sendText(cmd);
  settings.localEcho.val && msg(cmd);
};



// clear the child elements from any element (like the output window)
function clearscreen (which) {
  document.getElementById(which).innerHTML = '';
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
    var html = '<' + tag + (attrs ? ' ' : '') + attrs + '>';

    var start;
    if (tag[0] !== '/') {
      start = true;
    } else {
      start = false;
      tag = tag.substring(1);
    }

    if ((tag === 'XCH_PAGE') || 
        ((tag === 'IMG') && (attrs.search(/xch_graph=(("[^"]*")|('[^']*')|([^\s]*))/i) !== -1)) ||
        (tag === 'HR')) {
      console.log("unhandled pueblo", html);
      return;
    }


    if (start) {
      var div = document.createElement('div');

      html = html.replace(
        /xch_graph=(("[^"]*")|('[^']*')|([^\s]*))/i,
        ''
      );

      html = html.replace(
        /xch_mode=(("[^"]*")|('[^']*')|([^\s]*))/i,
        ''
      );

      html = html.replace(
        /xch_hint="([^"]*)"/i,
        'title="$1"'
      );

      div.innerHTML = html.replace(
        /xch_cmd="([^"]*)"/i,
        "onClick='xch_cmd(&quot;$1&quot;)'"
      );

      div.setAttribute('target', '_blank');

      output.pushElement(div.firstChild);
    } else {
      output.popElement();
    }
  };



  // handle incoming command prompt
  conn.onPrompt = function (text) {
    // replace anything in cmdprompt with text
    // cmdprompt is an emulated terminal, so use appendText() to get ansi parsed
    cmdprompt.innerHTML = '';
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
    entry.style.height = parseInt(this.numInputLines.val) + 'em';
    keepAliveLabel.innerHTML='KeepAlive('+keepAliveTime.value+'s)';
  };



});

var settings = new SettingsClass(window,document,undefined);
