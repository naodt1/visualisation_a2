import * as d3 from "d3";



// load and filter the dataset (option 2, see A1 for option 1)
// for this task, we additionally filter for the winter season
const athletes = await d3.csv("data/athlete_events.csv", d3.autoType)
	.then(athlete => athlete.filter(athlete => athlete.Season == "Winter"))
console.log(athletes)

const city_country = await d3.json("data/city_to_country.json");
console.log(city_country);



