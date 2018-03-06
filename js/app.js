/**
 * Copyright 2013 dc-square GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author: Christoph Schäbel
 */

var websocketclient = {
    'client': null,
    'lastMessageId': 1,
    'lastSubId': 1,
    'subscriptions': [],
    'messages': [],
    'connected': false,

    'connect': function () {

        var host = $('#urlInput').val();
        var port = parseInt($('#portInput').val(), 10);
        var clientId = $('#clientIdInput').val();
        var username = $('#userInput').val();
        var password = $('#pwInput').val();
        var keepAlive = parseInt($('#keepAliveInput').val());
        var cleanSession = $('#cleanSessionInput').is(':checked');
        var lwTopic = $('#lwTopicInput').val();
        var lwQos = parseInt($('#lwQosInput').val());
        var lwRetain = $('#LWRInput').is(':checked');
        var lwMessage = $('#LWMInput').val();
        var ssl = $('#sslInput').is(':checked');

        this.client = new Messaging.Client(host, port, clientId);
        this.client.onConnectionLost = this.onConnectionLost;
        this.client.onMessageArrived = this.onMessageArrived;

        var options = {
            timeout: 3,
            keepAliveInterval: keepAlive,
            cleanSession: cleanSession,
            useSSL: ssl,
            onSuccess: this.onConnect,
            onFailure: this.onFail
        };

        if (username.length > 0) {
            options.userName = username;
        }
        if (password.length > 0) {
            options.password = password;
        }
        if (lwTopic.length > 0) {
            var willmsg = new Messaging.Message(lwMessage);
            willmsg.qos = lwQos;
            willmsg.destinationName = lwTopic;
            willmsg.retained = lwRetain;
            options.willMessage = willmsg;
        }

        this.client.connect(options);
    },

    'onConnect': function () {
        websocketclient.connected = true;
        console.log("connected");
        var body = $('body').addClass('connected').removeClass('notconnected').removeClass('connectionbroke');

        websocketclient.render.hide('conni');
        websocketclient.render.show('publish');
        websocketclient.render.show('sub');
        websocketclient.render.show('messages');
        var rndColor = websocketclient.getRandomColor();
        $("#colorChooser").minicolors('value', rndColor);
        websocketclient.subscribe("thereisnospoon"   , 2, $('#colorChooser').val().substring(1))
        rndColor = websocketclient.getRandomColor();
        $("#colorChooser").minicolors('value', rndColor);
        websocketclient.subscribe("thereisnospoon/pc", 2, $('#colorChooser').val().substring(1))
    },

    'onFail': function (message) {
        websocketclient.connected = false;
        console.log("error: " + message.errorMessage);
        websocketclient.render.showError('Connect failed: ' + message.errorMessage);
    },

    'onConnectionLost': function (responseObject) {
        websocketclient.connected = false;
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObject.errorMessage);
        }
        $('body.connected').removeClass('connected').addClass('notconnected').addClass('connectionbroke');
        websocketclient.render.show('conni');
        websocketclient.render.hide('publish');
        websocketclient.render.hide('sub');
        websocketclient.render.hide('messages');

        //Cleanup messages
        websocketclient.messages = [];
        websocketclient.render.clearMessages();

        //Cleanup subscriptions
        websocketclient.subscriptions = [];
        websocketclient.render.clearSubscriptions();
    },

    'onMessageArrived': function (message) {
//        console.log("onMessageArrived:" + message.payloadString + " qos: " + message.qos);

        var subscription = websocketclient.getSubscriptionForTopic(message.destinationName);

        var messageObj = {
            'topic': message.destinationName,
            'retained': message.retained,
            'qos': message.qos,
            'payload': message.payloadString,
            'timestamp': moment(),
            'subscriptionId': subscription.id,
            'color': websocketclient.getColorForSubscription(subscription.id)
        };

        console.log(messageObj);
        messageObj.id = websocketclient.render.message(messageObj);
        websocketclient.messages.push(messageObj);
        PNotify.desktop.permission();
        PNotify.prototype.options.delay = 750;
        //update_timer_display();
        (new PNotify({
            title: messageObj.topic,
            text: messageObj.payload,
            desktop: {
                desktop: true
            }
        })).get().click(function(e) {
            if(ValidURL(messageObj.payload)){
                window.open(messageObj.payload);
            }
                var pnotice = (new PNotify({
                    title: messageObj.topic,
                    //text: messageObj.payload,
                    confirm: {
                        prompt: true,
                        prompt_default: messageObj.payload
                    },
                    buttons: {
                        closer: false,
                        sticker: false
                    }
                })).get().on('pnotify.confirm', function(e, notice, val) {
                    setClipboardText($('<div/>').text(val).html());
                    // notice.cancelRemove().update({
                    //     title: 'Copied',
                    //     text: $('<div/>').text(val).html(),
                    //     icon: true,
                    //     type: 'info',
                    //     hide: true,
                    //     addClass: 'translucent',
                    //     confirm: {
                    //         prompt: false
                    //     },
                    //     buttons: {
                    //         closer: false,
                    //         sticker: true
                    //     }
                    // });
                    notice.remove();

                }).on('pnotify.cancel', function(e, notice) {
                    notice.remove();
                });
                // pnotice.get().click(function() {
                //     notice.remove();
                // });
            
        });
    },

    'disconnect': function () {
        this.client.disconnect();
    },

    'publish': function (topic, payload, qos, retain) {

        if (!websocketclient.connected) {
            websocketclient.render.showError("Not connected");
            return false;
        }

        var message = new Messaging.Message(payload);
        message.destinationName = topic;
        message.qos = qos;
        message.retained = retain;
        this.client.send(message);
    },

    'subscribe': function (topic, qosNr, color) {

        if (!websocketclient.connected) {
            websocketclient.render.showError("Not connected");
            return false;
        }

        if (topic.length < 1) {
            websocketclient.render.showError("Topic cannot be empty");
            return false;
        }

        if (_.find(this.subscriptions, { 'topic': topic })) {
            websocketclient.render.showError('You are already subscribed to this topic');
            return false;
        }

        this.client.subscribe(topic, {qos: qosNr});
        if (color.length < 1) {
            color = '999999';
        }

        var subscription = {'topic': topic, 'qos': qosNr, 'color': color};
        subscription.id = websocketclient.render.subscription(subscription);
        this.subscriptions.push(subscription);
        return true;
    },

    'unsubscribe': function (id) {
        var subs = _.find(websocketclient.subscriptions, {'id': id});
        this.client.unsubscribe(subs.topic);
        websocketclient.subscriptions = _.filter(websocketclient.subscriptions, function (item) {
            return item.id != id;
        });

        websocketclient.render.removeSubscriptionsMessages(id);
    },

    'deleteSubscription': function (id) {
        var elem = $("#sub" + id);

        if (confirm('Wirklich löschen ?')) {
            elem.remove();
            this.unsubscribe(id);
        }
    },

    'getRandomColor': function () {
        var r = (Math.round(Math.random() * 255)).toString(16);
        var g = (Math.round(Math.random() * 255)).toString(16);
        var b = (Math.round(Math.random() * 255)).toString(16);
        return r + g + b;
    },

    'getSubscriptionForTopic': function (topic) {
        var i;
        for (i = 0; i < this.subscriptions.length; i++) {
            if (this.compareTopics(topic, this.subscriptions[i].topic)) {
                return this.subscriptions[i];
            }
        }
        return false;
    },

    'getColorForPublishTopic': function (topic) {
        var id = this.getSubscriptionForTopic(topic);
        return this.getColorForSubscription(id);
    },

    'getColorForSubscription': function (id) {
        try {
            if (!id) {
                return '99999';
            }

            var sub = _.find(this.subscriptions, { 'id': id });
            if (!sub) {
                return '999999';
            } else {
                return sub.color;
            }
        } catch (e) {
            return '999999';
        }
    },

    'compareTopics': function (topic, subTopic) {
        var pattern = subTopic.replace("+", "(.+?)").replace("#", "(.*)");
        var regex = new RegExp("^" + pattern + "$");
        return regex.test(topic);
    },

    'render': {

        'showError': function (message) {
            alert(message);
        },
        'messages': function () {

            websocketclient.render.clearMessages();
            _.forEach(websocketclient.messages, function (message) {
                message.id = websocketclient.render.message(message);
            });

        },
        'message': function (message) {

            var largest = websocketclient.lastMessageId++;

            var html = '<li class="messLine id="' + largest + '">' +
                '   <div class="row large-12 mess' + largest + '" style="border-left: solid 10px #' + message.color + '; ">' +
                '       <div class="large-12 columns messageText">' +
                '           <div class="large-3 columns date">' + message.timestamp.format("YYYY-MM-DD HH:mm:ss") + '</div>' +
                '           <div class="large-5 columns topicM truncate" id="topicM' + largest + '" title="' + Encoder.htmlEncode(message.topic, 0) + '">Topic: ' + Encoder.htmlEncode(message.topic) + '</div>' +
                '           <div class="large-2 columns qos">Qos: ' + message.qos + '</div>' +
                '           <div class="large-2 columns retain">';
            if (message.retained) {
                html += 'Retained';
            }
            html += '           </div>' +
                '           <div class="large-12 columns message break-words">' + Encoder.htmlEncode(message.payload) + '</div>' +
                '       </div>' +
                '   </div>' +
                '</li>';
            $("#messEdit").prepend(html);
            return largest;
        },

        'subscriptions': function () {
            websocketclient.render.clearSubscriptions();
            _.forEach(websocketclient.subscriptions, function (subs) {
                subs.id = websocketclient.render.subscription(subs);
            });
        },

        'subscription': function (subscription) {
            var largest = websocketclient.lastSubId++;
            $("#innerEdit").append(
                '<li class="subLine" id="sub' + largest + '">' +
                    '   <div class="row large-12 subs' + largest + '" style="border-left: solid 10px #' + subscription.color + '; background-color: #ffffff">' +
                    '       <div class="large-12 columns subText">' +
                    '           <div class="large-1 columns right closer">' +
                    '              <a href="#" onclick="websocketclient.deleteSubscription(' + largest + '); return false;">x</a>' +
                    '           </div>' +
                    '           <div class="qos">Qos: ' + subscription.qos + '</div>' +
                    '           <div class="topic truncate" id="topic' + largest + '" title="' + Encoder.htmlEncode(subscription.topic, 0) + '">' + Encoder.htmlEncode(subscription.topic) + '</div>' +
                    '       </div>' +
                    '   </div>' +
                    '</li>');
            return largest;
        },

        'toggleAll': function () {
            websocketclient.render.toggle('conni');
            websocketclient.render.toggle('publish');
            websocketclient.render.toggle('messages');
            websocketclient.render.toggle('sub');
        },

        'toggle': function (name) {
            $('.' + name + 'Arrow').toggleClass("closed");
            $('.' + name + 'Top').toggleClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideToggle();
        },

        'hide': function (name) {
            $('.' + name + 'Arrow').addClass("closed");
            $('.' + name + 'Top').addClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideUp();
        },

        'show': function (name) {
            $('.' + name + 'Arrow').removeClass("closed");
            $('.' + name + 'Top').removeClass("closed");
            var elem = $('#' + name + 'Main');
            elem.slideDown();
        },

        'removeSubscriptionsMessages': function (id) {
            websocketclient.messages = _.filter(websocketclient.messages, function (item) {
                return item.subscriptionId != id;
            });
            websocketclient.render.messages();
        },

        'clearMessages': function () {
            $("#messEdit").empty();
        },

        'clearSubscriptions': function () {
            $("#innerEdit").empty();
        }
    }
};

function ValidURL(str) {
    pattern =  /^(?:(?:https?|ftp):\/\/)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/\S*)?$/;
    return pattern.test(str)
  }

  function setClipboardText(text){
    var id = "mycustom-clipboard-textarea-hidden-id";
    var existsTextarea = document.getElementById(id);

    if(!existsTextarea){
        console.log("Creating textarea");
        var textarea = document.createElement("textarea");
        textarea.id = id;
        // Place in top-left corner of screen regardless of scroll position.
        textarea.style.position = 'fixed';
        textarea.style.top = 0;
        textarea.style.left = 0;

        // Ensure it has a small width and height. Setting to 1px / 1em
        // doesn't work as this gives a negative w/h on some browsers.
        textarea.style.width = '1px';
        textarea.style.height = '1px';

        // We don't need padding, reducing the size if it does flash render.
        textarea.style.padding = 0;

        // Clean up any borders.
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';

        // Avoid flash of white box if rendered for any reason.
        textarea.style.background = 'transparent';
        document.querySelector("body").appendChild(textarea);
        console.log("The textarea now exists :)");
        existsTextarea = document.getElementById(id);
    }else{
        console.log("The textarea already exists :3")
    }

    existsTextarea.value = text;
    existsTextarea.select();

    try {
        var status = document.execCommand('copy');
        if(!status){
            console.error("Cannot copy text");
        }else{
            console.log("The text is now on the clipboard");
        }
    } catch (err) {
        console.log('Unable to copy.');
    }
}
