var ReactDOM = require('react-dom');
var React = require('react');
var cookie = require('react-cookie')
let socket = io();

//INDIVIDUAL COMPONENTS





var UsersList = React.createClass({
    render() {
        return (
            <div className='users'>
                <h3> Online Users </h3>
                <ul>
                    {
                        this.props.users.map((user, i) => {
                            return (
                                <li key={i}>
                                    {user}
                                </li>
                            );
                        })
                    }
                </ul>
            </div>
        );
    }
});

var Message = React.createClass({
    render() {
        if (this.props.nickHistory.indexOf(this.props.user) !== -1) {//this.props.currUser === this.props.user
            var MessageType = "messageOwn"
            var style = {
                color: '#' + this.props.hexcolor
            };
        } else {
            var MessageType = "message"
            var style = {
                color: '#000000'
            };
        }
        return (
            <div style={style} className={MessageType}>
                <span >{this.props.timestamp} </span>
                <strong >{this.props.user} :</strong>
                <span>{this.props.text}</span>
            </div>
        );
    }
});

var MessageList = React.createClass({
    render() {
        return (
            <div className='messages'>
                <h2> Conversation: </h2>
                {
                    this.props.messages.map((message, i) => {
                        return (
                            <Message
                                key={i}
                                user={message.user}
                                text={message.text}
                                timestamp={message.timestamp}
                                nickHistory={this.props.nickHistory}
                                hexcolor={this.props.userColor}
                            />
                        );
                    })
                }
            </div>
        );
    }
});

var MessageForm = React.createClass({

    getInitialState() {
        return { text: '' };
    },

    handleSubmit(e) {
        e.preventDefault();
        var message = {
            user: this.props.user,
            text: this.state.text
        }
        this.props.onMessageSubmit(message);
        this.setState({ text: '' });
    },

    changeHandler(e) {
        this.setState({ text: e.target.value });
    },

    render() {
        return (
            <div className='message_form'>
                <h3>Write New Message</h3>
                <form onSubmit={this.handleSubmit}>
                    <input
                        onChange={this.changeHandler}
                        value={this.state.text}
                    />
                </form>
            </div>
        );
    }
});

var ChangeNameForm = React.createClass({
    getInitialState() {
        return { newName: '' };
    },

    onKey(e) {
        this.setState({ newName: e.target.value });
    },

    handleSubmit(e) {
        e.preventDefault();
        var newName = this.state.newName;
        this.props.onChangeName(newName);
        this.setState({ newName: '' });
    },

    render() {
        return (
            <div className='change_name_form'>
                <h3> Change Name </h3>
                <form onSubmit={this.handleSubmit}>
                    <input
                        onChange={this.onKey}
                        value={this.state.newName}
                    />
                </form>
            </div>
        );
    }
});


var CurrentUser = React.createClass({
    render() {
        return (
            <div>
                <p>You Are: {this.props.user}</p>
            </div>
        );
    }
});

//CHAT APP MOUNT
var ChatApp = React.createClass({

    getInitialState() {
        return { users: [], messages: [], text: '', user: '', userColor: '000000', usernamesUsedSession: [] };
    },

    componentDidMount() {
        socket.on('init', this._initialize);
        socket.on('send:message', this._messageRecieve);
        socket.on('user:join', this._userJoined);
        socket.on('user:left', this._userLeft);
        socket.on('change:name', this._userChangedName);
    },

    _initialize(data) {
        var { users, name, messages } = data;

        var pastName = cookie.load('currName')
        console.log("cookie:" + pastName)

        usernamesUsedSession = [];
        usernamesUsedSession.push(name)
        for (i = 0; i < messages.length; i++) {
            let d = new Date(messages[i].timestamp);
            messages[i].timestamp = d.toString();
        }
        console.log("this is user: " + name)
        reverseMSG = messages;
        reverseMSG.reverse()

        this.setState({ users, user: name, messages, usernamesUsedSession });
        if (typeof pastName != 'undefined') {
            name = pastName
            this.handleChangeName(name);

        }
    },

    _messageRecieve(message) {
        var { messages } = this.state;
        var d = new Date(message.timestamp);
        message.timestamp = d.toString();
        messages.push(message);
        this.setState({ messages });
    },

    _userJoined(data) {
        var { users, messages } = this.state;
        var { name } = data;
        users.push(name);
        messages.push({
            user: 'APPLICATION BOT',
            text: name + ' Joined'
        });
        this.setState({ users, messages });
    },

    _userLeft(data) {
        var { users, messages } = this.state;
        var { name } = data;
        var index = users.indexOf(name);
        users.splice(index, 1);
        messages.push({
            user: 'APPLICATION BOT',
            text: name + ' Left'
        });
        this.setState({ users, messages });
    },

    _userChangedName(data) {
        var { oldName, newName } = data;
        var { users, messages } = this.state;
        var index = users.indexOf(oldName);
        users.splice(index, 1, newName);
        messages.push({
            user: 'APPLICATION BOT',
            text: 'Change Name : ' + oldName + ' ==> ' + newName
        });
        this.setState({ users, messages });
    },

    handleMessageSubmit(message) {

        if (message.text.indexOf("/nick ") !== -1) {
            var newNick = message.text.replace("/nick ", "");
            this.handleChangeName(newNick);

        } else if (message.text.indexOf("/nickcolor ") !== -1) {
            var hexcolor = message.text.replace("/nickcolor ", "");
            this.handleChangedColor(hexcolor)
            console.log("trying to change colors")
        }
        else {
            var { messages } = this.state;
            var self = this;
            socket.emit('send:message', message, function (returnedMSG) {
                var d = new Date(returnedMSG.timestamp);
                returnedMSG.timestamp = d.toString();
                messages.push(returnedMSG);
                self.setState({ messages });
            });
        }
    },


    handleChangedColor(hexcolor) {
        if (hexcolor.length !== 6) {
            return alert(hexcolor + "is not a valid RBG color in hex");
        } else {
            this.setState({ userColor: hexcolor });
        }
    },


    handleChangeName(newName) {
        var oldName = this.state.user;
        var { messages } = this.state;

        socket.emit('change:name', { name: newName }, (result) => {
            if (!result) {
                return alert('Choose another nickname, ' + newName + " is already taken");
            }
            var { users, usernamesUsedSession } = this.state;
            var index = users.indexOf(oldName);
            users.splice(index, 1, newName);
            messages.push({
                user: 'APPLICATION BOT',
                text: 'You have changed names : ' + oldName + ' ==> ' + newName
            });
            usernamesUsedSession.push(newName);
            console.log("usernames used so far:" + usernamesUsedSession);
            cookie.save('currName', newName, { path: '/' });

            this.setState({ messages, users, user: newName, usernamesUsedSession });
        });
    },

    render() {
        return (
            <div>
                <UsersList
                    users={this.state.users}
                />
                <CurrentUser
                    user={this.state.user}
                />
                <MessageList
                    messages={this.state.messages}
                    currUser={this.state.user}
                    userColor={this.state.userColor}
                    nickHistory={this.state.usernamesUsedSession}

                />
                <MessageForm
                    onMessageSubmit={this.handleMessageSubmit}
                    user={this.state.user}
                />
            </div>
        );
    }
});

ReactDOM.render(<ChatApp />, document.getElementById('app'));
