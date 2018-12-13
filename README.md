## WebSockClient (WSClient)

# NOTE: This is the barebones socket library and minimal client implementation.
**Please see <https://github.com/grapenut/mush-portal> for an example client with a more advanced user interface built using Facebook's React.js**

WSClient is a JavaScript library for making websocket connections from a browser to a websocket-enabled PennMUSH server.

See <https://grapenut.github.io/websockclient/> for a live demo.

- Supports **xterm256** color.
- Supports embedded HTML/CSS.
- Supports embedded clickable command links (Pueblo).
- Handle and display command input prompts.
- Recall user input command history.
- Provide default handlers for key press events.

__wsclient.js__ provides the `WSClient` class which has 3 exported objects:

`conn = WSClient.connect(url)` opens a connection to `url` and returns the connection object.
Use the `conn` object to setup callbacks that handle incoming data.

`output = WSClient.output(root)` turns DOM element `root` into an output terminal with xterm256 color emulation.
You may define multiple output terminals (e.g. chat window, combat log, main output).

`input = WSClient.input(root)` turns DOM element `root` into a user input box with command history and key events.

__index.html__ is a minimal implementation of the client. It demonstrates
how to setup the required event callbacks and use the default event handlers.

__style.css__ provides basic visual styling and content layout for the elements in __index.html__.

__ansi.css__ defines the style tags used in xterm256 color emulation.

__embed.html__ is a single-file version that is suitable for serving directly from the MUSH's HTTP redirect page.
It links directly to the current __ansi.css__ and __wsclient.js__ from the `master` branch on github.com.


# 
## Connect
#### Create a Websocket Connection

`conn = WSClient.connect(url)` returns a connection object. The `url` is of the form ws://host:port/wsclient or wss://host:port/wsclient for SSL. 

#### Connection Functions

`conn.isConnected()` returns true if the socket is connected and ready.

`conn.sendText(text)` sends the command `text` to the server.

`conn.sendObject(obj)` sends the JSON object `obj` to the server. _Not currently supported by any servers._

`conn.close()` closes the connection socket.

`conn.reconnect()` reinitiates a connection that was closed by the remote server.

#### Connection Events

Overload events on the connection object in order to handle the different types of incoming data and send it to the terminal.

`conn.onOpen = function(evt)` can be overloaded to automatically send the connect command with username/password (e.g. from an input box).

`conn.onError = function(evt)` handles reporting for socket errors.

`conn.onClose = function(evt)` is called whenever the connection socket is closed remotely.

`conn.onMessage = function(channel, data)` handles all incoming Websocket data. Used internally to split data into different channels.
**__You should not overload this function unless you are adding new channels.__**

`conn.onText = function(data)` handles incoming plain text. The variable `data` is a string containing plain text and ANSI escape codes.

`conn.onHTML = function(data)` handles incoming HTML code. The variable `data` is a string containing HTML code to be rendered.

`conn.onPueblo = function(data)` handles incoming Pueblo links. The variable `data` is a string containing a single tag and attributes (without < or >).

`conn.onPrompt = function(data)` handles incoming command prompts. The variable `data` is a string containing plain text and ANSI escape codes.

`conn.onObject = function(obj)` handles an incoming JSON object. There is no default implementation, but one could use `obj` to pass bulk JSON data for e.g. maps, huds, seperate combat window, etc.


# 
## Output
#### Create an Output Terminal

`output = WSClient.output(root)` returns a terminal emulator using DOM element `root` as the output container (usually a div).

#### Terminal Functions

`output.appendText(text)` appends `text` to the output terminal, parsing any color escape codes into HTML/CSS.

`output.appendHTML(html)` appends `html` as a code fragment to the end of the output terminal.

`output.appendPueblo(tag, attrs)` parses pueblo `tag` with `attrs` and appends as interactive HTML links in the output terminal.

`output.appendMessage(class, message)` appends `message` to the output terminal, using `class` to style it.

`output.clear()` will clear content from the output terminal.

#### Terminal Events

`output.onCommand = function(cmd)` handles Pueblo links. Responsible for sending `cmd` to the connection object.
`cmd = WSClient.parseCommand(cmd)` prompts the user for input and replaces the ?? token if one exists in `cmd`.

`output.onLine = WSClient.parseLinks` is called to handle finished lines just before they are written to the terminal.
**__You should not overload this function unless you set it null to disable link parsing.__**

`WSClient.parseLinks` is a utility function provided to convert URL strings into interactive links.


# 
## Input

The UserInput handler provides command history and key event callbacks for a user input text box.
There are 4 keys captured: enter, escape, and two others for cycling history forward and backward.
The default keys for cycling history are `ctrl+p` and `ctrl+n` but these can be overridden (e.g. to use up/down arrow keys).

#### Create a User Input Handler

`input = WSClient.input(root)` returns an input handler using DOM element `root` as the text input container (usually a textarea).

#### User Input Functions

`input.saveCommand()` pushes the current value of the input box onto the command history stack and clears the input box.

`input.cycleBackward()` replaces the current value of the input box with the previous command from history.

`input.cycleForward()` replaces the current value of the input box with the next command from history.

`input.moveCursor()` moves the input cursor to the end of the text currently in the input box.

`input.clear()` clears the current text in the input box.

`input.value()` returns the current value of the text in the input box.

`input.focus()` puts the input cursor focus on the input box.

#### User Input Keys

`input.keyCycleForward = function(key) { return (key.code === 78 && key.ctrl); };` returns true if `key` matches the key you want to use for cycling history forward. Default is `ctrl+n`.

`input.keyCycleBackward = function(key) { return (key.code === 80 && key.ctrl); };` returns true if `key` matches the key you want to use for cycling history backward. Default is `ctrl+p`.

#### User Input Events

`input.onKeyDown = function(evt) { WSClient.pressKey(this, evt); };` handles key presses in the input box. Here we used the default `WSClient.pressKey` function.

`input.onKeyUp = function(evt) { WSClient.releaseKey(this, evt); };` handles key releases in the input box. Here we used the default `WSClient.releaseKey` function.

`input.onEnter = function(cmd)` handles when the user presses `ENTER`. Responsible for sending input command to the server.

`input.onEscape = function()` handles when the user presses `ESCAPE`.


