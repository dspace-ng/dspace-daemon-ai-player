var Faye = require('faye');
var GameLoopDispatch = require('game-loop-dispatch');
var uuid = require('node-uuid');
var _ = require('lodash');

var hubUrl = 'http://192.168.1.186:5000';
var bayeuxUrl = hubUrl + '/bayeux';

var avatars = [
  'elvis',
  'emo',
  'escafandra',
  'estilista',
  'extraterrestre',
  'fisicoculturista',
  'funky',
  'futbolista_brasilero',
  'gay',
  'geisha',
  'ghostbuster',
  'glamrock_singer',
  'guerrero_chino',
  'hiphopper',
  'hombre_hippie'
];

var randomAvatar = function(){
  return avatars[Math.floor(Math.random()*avatars.length)];
};

var teams = ['ESC', 'LL+GW', 'ORWELL', 'FH-J', 'CY', undefined];

var randomTeam = function(){
  return teams[Math.floor(Math.random()*teams.length)];
};

var Position = function(){
  this.lat = 47.05 + Math.floor(Math.random()*30)*0.001;
  this.lng = 15.42 + Math.floor(Math.random()*30)*0.001;
};

var Wind = function(){
  this.lat = Math.floor(Math.random()*10)*0.0001;
  this.lng = Math.floor(Math.random()*10)*0.0001;
};


var Ghost = function(hub){
  this.hub = hub;
  this.uuid = uuid();
  this.avatar = randomAvatar() ;
  this.nickname = this.avatar;
  this.team = randomTeam();
  this.color = '#' + Math.floor(Math.random()*16777215).toString(16);
  this.channels = {
    track: {
      url: bayeuxUrl,
      path: '/' + this.uuid + '/track',
      protocol: 'bayeux'
    }
  };
  this.feeds = {
    track: {
      url: hubUrl,
      path: '/' + this.uuid + '/track',
    }
  };
  this.position = new Position();
  this.wind = new Wind();
  this.range = Math.floor(Math.random()*15) + 10;
  this.counter = Math.floor(Math.random()*this.range);

  this.toJSON = function(){
    return {
      uuid: this.uuid,
      nickname: this.nickname,
      avatar: this.avatar,
      team: this.team,
      color: this.color,
      feeds: this.feeds,
      channels: this.channels
    };
  }.bind(this);

  this.publish = function(){
    this.hub.publish(this.channels.track.path,
                   { coords:
                     { latitude: this.position.lat,
                       longitude: this.position.lng,
                       accuracy: 20 },
                       timestamp: new Date().getTime(),
                       player: { uuid: this.uuid } }
                  );

    //this.avatar = randomAvatar();
    this.hub.publish('/roster', this.toJSON() );

    if(this.counter % this.range === 0){
      this.wind.lat *= -1;
    }
    if(this.counter % this.range === Math.floor(this.range / 2)){
      this.wind.lng *= -1;
    }
    this.position.lat += this.wind.lat;
    this.position.lng += this.wind.lng;

    this.counter++;

  }.bind(this);
};

var pubsub = new Faye.Client(bayeuxUrl);

var loop = new GameLoopDispatch({ interval: 2000 });

var ghosts = [];
_.times(12, function(){ ghosts.push(new Ghost(pubsub)); });

loop.tick = function(){
  _.each(ghosts, function(ghost){ ghost.publish(); });
};

loop.start();
