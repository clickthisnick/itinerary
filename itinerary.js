  function EventAction(actionTime,actionName) {
    var self = this;
    self.actionName = actionName;
    self.actionTime = parseInt(actionTime);
    self.doTime = ko.observable("");
    self.completed = false;
  }

  function toggleAction(text,options){
    var optionsIndex = options.length-1;

    for (i = 0; i <= optionsIndex; i++) {
      if (i == optionsIndex){
        return options[0];
      }
      else if (text == options[i]){
        return options[i+1];
      }
    }
  };

  // Overall viewmodel for this screen, along with initial state
  function ItineraryViewModel() {
    var self = this;

    self.eventPromptText = "What is being done?";
    self.actionFirstPromptText = "What do you do first?";
    self.actionAferPromptText = "What do you do next?";

    self.timePromptText = "At what time?";
    self.durationPrompt = "How long (In Min)?";

    self.whatPrompt = ko.observable(self.eventPromptText);
    self.timePrompt = ko.observable(self.timePromptText);

    self.inputWhat = ko.observable("");
    self.inputTime = ko.observable("");

    self.eventName = ko.observable("");
    self.eventTime = ko.observable("");

    self.actions = ko.observableArray([]);

    self.removeToggleText = "X";
    self.upToggleText = "UP";
    self.downToggleText = "DN";

    self.toggleText = ko.observable(self.removeToggleText);

    self.switchToggle = function(){
      toggleAction(self.toggleText(),[self.removeToggleText,self.upToggleText,self.downToggleText]);
    }

    self.actionText = ko.computed(function() {
      var toggleText = self.toggleText();
      if (toggleText == self.removeToggleText){
        return "Remove";
      }
      else if (toggleText == self.upToggleText){
        return "Move Up";
      }
      else if (toggleText == self.downToggleText){
        return "Move Down";
      }
    });

    self.parseInputs = function(){
      var inputWhat = self.inputWhat().replace(/(\w)(\w*)/g,
      function(g0,g1,g2){return g1.toUpperCase() + g2.toLowerCase();});
      self.inputWhat(inputWhat);

      var inputTime = self.inputTime().toLowerCase();
      self.inputTime(inputTime);
    };

    self.clickAdd = function(){
      // Covert to Pascal Case

      if (self.inputWhat() === "" || self.inputTime() === ""){
        alert("Please enter both a what and time");
        return;
      }

      self.parseInputs();

      if (self.eventName() === ""){
        self.addEvent();
      }
      else {
        self.addAction();
      }
      self.calculateActionTimes();
      self.clearInputs();
      self.changeText();
    };

    self.changeText = function(){
      // Changing the event/time prompt
      if (self.eventName() === ""){
        self.whatPrompt(self.eventPromptText);
        self.timePrompt(self.timePromptText);
      }
      else if(self.actions().length === 0){
        self.whatPrompt(self.actionFirstPromptText);
        self.timePrompt(self.durationPrompt);
      }
      else{
        self.whatPrompt(self.actionAferPromptText);
        self.timePrompt(self.durationPrompt);
      }
    };

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
      self.actions.push(new EventAction(self.inputTime(), self.inputWhat()));
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

    self.calculateActionTimes = function(){
      var total = 0;
      for (var i = self.actions().length - 1; i >= 0; i--) {
        total+= self.actions()[i].actionTime;

        var timeString = self.getTime(total);

        self.actions()[i].doTime(timeString);
      }
    };

    self.toggleAction = function(action){
      var text = self.toggleText();
      if (text == self.removeToggleText){
        self.removeAction(action);
        return;
      }

      var index = self.actions().indexOf(action);
      var item = self.actions()[index];
      var direction;

      if (text == self.upToggleText){
        direction = "up";
      }
      else if (text == self.downToggleText){
        direction = "down";
      }

      self.actions().movePosition(item,direction);
      self.actions.push(new EventAction("", ""));
      self.actions.pop();
      self.calculateActionTimes();
    };

    self.removeAction = function(action) {
      self.actions.remove(action);
      self.calculateActionTimes();
      self.changeText();
    };

    self.removeEvent = function() {
      self.eventName("");
      self.eventTime("");
      self.calculateActionTimes();
      self.changeText();
    };

    Array.prototype.movePosition = function(value, direction, by) {

      if (direction == "up"){
        var index = this.indexOf(value),
        newPos = index + (by || 1);
      }
      else if (direction == "down"){
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

var itineraryViewModel = new ItineraryViewModel();

ko.applyBindings(itineraryViewModel);
