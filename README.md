# WebSockClient (WSClient)

WSClient is a JavaScript library for making websocket connections from a browser to a websocket-enabled PennMUSH server.

- **xterm256** color support.
- Full HTML/CSS support.
- Embed clickable command links (Pueblo).
- Handle and display command input prompts.

__wsclient.js__ provides the `WSClient` class which has 3 exported objects:

```js
conn = WSClient.open(url)
```
Open a connection to `url` and return the connection object.
Use the `conn` object to setup callbacks that handle incoming data.

```js
output = WSClient.output(root)
```
Turn DOM element `root` into an output terminal with xterm256 color emulation.
You may define multiple output terminals (e.g. chat window, combat log, main output).

```js
input = WSClient.input(root)
```
Turn DOM element `root` into a user input box with command history and key events.

__index.html__ is a minimal implementation of the client. It demonstrates
how to setup the required event callbacks and use the default event handlers.

__style.css__ provides basic visual styling and content layout for the elements in __index.html__.

__ansi.css__ defines the style tags used in xterm256 color emulation.


## Open

#### Open a Connection
`conn = WSClient.open(url)` returns a connection object. The `url` is of the form <ws://host:port/wsclient> or <wss://host:port/wsclient> for SSL. 

#### Connection Functions
`conn.sendText(text)` sends the command `text` to the server.
`conn.sendObject(obj)` sends the JSON object `obj` to the server. _Not currently supported by any servers._
`conn.close()` closes the connection socket.

#### Connection Events
Overload events on the connection object in order to handle the different types of incoming data and send it to the terminal.

`conn.onOpen = function(evt)` can be overloaded to automatically send the connect command with username/password (e.g. from an input box).
`conn.onError = function(evt)` handles reporting for socket errors.
`conn.onClose = function(evt)` is called whenever the connection socket is closed remotely.

`conn.onMessage = function(channel, data)` handles all incoming Websocket data. Used internally to split data into different channels. **__Do not overload this function.__**

`conn.onText = function(text)` handles incoming plain text. Responsible for appending `text` to the output terminal.
`conn.onHTML = function(html)` handles incoming HTML code. Responsible for appending `html` to the output terminal.
`conn.onPueblo = function(tag, attrs)` handles incoming Pueblo links. Responsible for appending Pueblo `tag` and `attrs` to the output terminal.
`conn.onPrompt = function(text)` handles incoming command prompts. Responsible for appending `text` to the command prompt (or main output terminal).
`conn.onObject = function(obj)` handles an incoming JSON object. There is no default implementation, but one could use `obj` to pass bulk JSON data for e.g. maps, huds, seperate combat window, etc.


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
`output.onCommand = function(command)` handles Pueblo links. Responsible for sending `command` to the connection object.
`output.onLine = WSClient.parseLinks` is called to handle finished lines just before they are written to the terminal. You probably won't change this.
`WSClient.parseLinks` is a utility function provided to convert URL strings into interactive links.


## Input

The UserInput handler provides command history and key event callbacks for a user input text box.
There are 4 keys captured: enter, escape, and two others for cycling history forward and backward.
The default keys for cycling history are `ctrl+p` and `ctrl+n` but these can be overridden (e.g. to use up/down arrow keys).

#### Create a User Input Handler
`input = WSClient.input(root)` returns an input handler using DOM element `root` as the text input container (usually a textarea).

#### User Input Functions
`input.pushCommand()` pushes the current value of the input box onto the command history stack and clears the input box.
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
`input.onEnter = function()` handles when the user presses `ENTER`. Responsible for sending input command to the server.
`input.onEscape = function()` handles when the user presses `ESCAPE`.

