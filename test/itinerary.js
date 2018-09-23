const Util = require('./../src/util')
const Itinerary = require('./../src/itinerary');
const ko = require('knockout');

describe("Action toggle functionality", function() {

  var removeToggle = {'headerText':'Remove','buttonText':'X'};
  var upToggle = {'headerText':'Move Up','buttonText':'UP'};
  var downToggle = {'headerText':'Move Down','buttonText':'DN'};
  var options = [removeToggle,upToggle,downToggle];

	it("It toggles to the next action", function() {
    var action = Itinerary.toggleText('X',options);
    	expect(action['buttonText']).toBe('UP');
  	});

    it("It cycles to the beginning of the list", function() {
      var action = Itinerary.toggleText('UP',options);
      	expect(action['buttonText']).toBe('DN');
    	});
});

describe("Item manipulation", function() {

	it("I can remove items", function() {
    var items = ko.observableArray([1,2,3]);
    var newItems = Itinerary.removeItem(items,2)
    	expect(newItems[0]).toBe(1);
      expect(newItems[1]).toBe(3);
  	});

});

describe("When I get inputs", function() {

    it("They can be pascal case", function() {
      var text = Util.pascalCase("ApPle")
        expect(text).toBe("Apple");

      var text = Util.pascalCase("aPPle")
        expect(text).toBe("Apple");
    	});

});

