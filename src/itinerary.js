const ko = require('knockout');
const Util = require('util');
const moment = require('moment');

module.exports = class Itinerary {
  static EventAction(actionTime,actionName) {
      var self = this;
      self.actionName = actionName;
      self.actionTime = parseInt(actionTime);
      self.doTime = ko.observable("");
      self.completed = false;
    }

    static toggleText(text,options){
      var optionsIndex = options.length-1;

      for (let i = 0; i <= optionsIndex; i++) {
        if (i === optionsIndex){
          return options[0];
        }
        else if (text === options[i]['buttonText']){
          return options[i+1]
        }
      }
    };

    static removeItem(items,item){
        items.remove(item);
        return items()
    }

    // Overall viewmodel for this screen, along with initial state
    static ItineraryViewModel() {
      var self = this;

      self.removeButton = 'X'
      var removeButton = 'X';
      var moveUpButton = 'UP';
      var moveDownButton = 'DN';

      self.eventPromptText = "What is being done?";
      self.actionFirstPromptText = "What do you do first?";
      self.actionAfterPromptText = "What do you do next?";

      self.timePromptText = "At what time?";
      self.durationPrompt = "How long (In Min)?";

      self.whatPrompt = ko.observable(self.eventPromptText);
      self.timePrompt = ko.observable(self.timePromptText);

      self.inputWhat = ko.observable("");
      self.inputTime = ko.observable("");

      self.eventName = ko.observable("");
      self.eventTime = ko.observable("");

      self.items = ko.observableArray([]);
      self.toggleList = [{'headerText':'Remove','buttonText':removeButton},
                          {'headerText':'Move Up','buttonText':moveUpButton},
                          {'headerText':'Move Down','buttonText':moveDownButton}];

      self.buttonText = ko.observable(self.toggleList[0]['buttonText']);
      self.headerText = ko.observable(self.toggleList[0]['headerText']);

      self.switchToggle = function(){
        var toggle = toggleText(self.buttonText(),self.toggleList);
        self.buttonText(toggle['buttonText']);
        self.headerText(toggle['headerText']);
      }

      self.formatInputs = function(){
        self.inputWhat(Util.pascalCase(self.inputWhat()));
        self.inputTime(self.inputTime().toLowerCase());
      }

      self.clickAdd = function(){
        if (self.inputWhat() === "" || self.inputTime() === ""){
          alert("Please enter both a what and time");
        }
        else{
          self.formatInputs();

          if (self.eventName() === ""){
            self.addEvent();
          }
          else {
            self.addAction();
          }
          self.clearInputs();
        }
      };

      self.changeText = ko.computed(function() {
        // Changing the event/time prompt
        if (self.eventName() === ""){
          self.whatPrompt(self.eventPromptText);
          self.timePrompt(self.timePromptText);
        }
        else if(self.items().length === 0){
          self.whatPrompt(self.actionFirstPromptText);
          self.timePrompt(self.durationPrompt);
        }
        else{
          self.whatPrompt(self.actionAfterPromptText);
          self.timePrompt(self.durationPrompt);
        }
      });

      self.clearInputs = function(){
        self.inputWhat("");
        self.inputTime("");
      };

      self.addEvent = function(){
        self.eventName(self.inputWhat());
        self.eventTime(self.inputTime().toLowerCase());
        self.clearInputs();
      };

      self.addAction = function() {
        self.items.unshift(new EventAction(self.inputTime(), self.inputWhat()));
      };

      self.getTime = function(total){
        if (self.eventTime() !== ""){
          var time = moment(self.eventTime(), "hh:mm a");
          var timeString = time.subtract(total, 'minutes').format("hh:mm a");
          if (timeString[0] == "0"){
            return timeString.substr(1);
          }
          return timeString;
        }
        return "-";
      };

      self.calculateActionTimes = ko.computed(function() {
        var total = 0;
        for (var i = self.items().length - 1; i >= 0; i--) {
          total+= self.items()[i].actionTime;

          var timeString = self.getTime(total);

          self.items()[i].doTime(timeString);
        }
      }, self);

      self.toggleAction = function(item){
        var action = self.buttonText();

        if (action == removeButton){
          var items = removeItem(self.items,item);
          self.items(items);
        }
        else{
          var index = self.items().indexOf(item);
          var thisItem = self.items()[index];

          self.items().movePosition(thisItem,action);
          self.items.push(new EventAction("", ""));
          self.items.pop();
        }
      };

      self.removeEvent = function() {
        self.eventName("");
        self.eventTime("");
      };

      Array.prototype.movePosition = function(value, direction, by) {

        if (direction == moveUpButton){
          var index = this.indexOf(value),
          newPos = index + (by || 1);
        }
        else if (direction == moveDownButton){
          var index = this.indexOf(value),
          newPos = index - (by || 1);
        }

        if(index === -1)
        throw new Error("Element not found in array");

        if(newPos < 0)
        newPos = 0;

        this.splice(index,1);
        this.splice(newPos,0,value);
      };
    }
}