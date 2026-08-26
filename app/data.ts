export type Castaway = {
  id: string;
  name: string;
  age: number;
  job: string;
  hometown: string;
  tribe: "Savu" | "Toka" | "Unassigned";
  bio: string;
  image: string;
  status?: string;
};

const officialCast = [
  ["aaliyah-puglia", "Aaliyah Puglia", 24, "Chef", "Providence, RI", "A confident, adaptable chef who is comfortable when plans change quickly."],
  ["alexis-levine", "Alexis Levine", 34, "Criminal defense attorney", "Atlanta, GA", "An outgoing advocate who brings determination, persuasion, and a thoughtful read on people."],
  ["thien-an-nguyen", "An “Thien An” Nguyen", 24, "Medical student", "Fort Worth, TX", "A quick-witted and empathetic medical student with an outdoors background."],
  ["ana-sani", "Ana Sani", 34, "Voice actress", "Toronto, ON", "A playful, ambitious performer who plans to turn chaos into opportunity."],
  ["angelica-loblack", "Angelica “Jelly” Loblack", 29, "Sociology professor", "Bloomington, IN", "A curious professor whose social insight could become her strongest strategic tool."],
  ["brady-booker", "Brady Booker", 27, "Professional wrestler", "Knoxville, TN", "An intense but fun physical competitor who understands performance and pressure."],
  ["carter-krull", "Carter Krull", 24, "Livestock farmer", "Sioux Falls, SD", "An adventurous farmer built for hard work and determined competition."],
  ["cristian-chavez", "Cristian Chavez", 26, "Head of HR", "Salt Lake City, UT", "A loud, energetic relationship builder who expects an unpredictable social game."],
  ["daniel-kilby", "Danny “Kilby” Kilby", 30, "Game designer", "London, ON", "A playful systems thinker who loves puzzles, risk, and unconventional moves."],
  ["devin-way", "Devin Way", 33, "Actor", "Los Angeles, CA", "A charming and loyal performer with the composure to handle a big moment."],
  ["eric-macksoud", "Eric Macksoud", 34, "Mental health counselor", "Windsor Locks, CT", "An animated, empathetic listener who may hear more than people intend to reveal."],
  ["jenna-greenawalt", "Jenna Doore", 30, "Wedding photographer", "Toledo, OH", "An energetic observer who is used to reading rooms and catching changing dynamics."],
  ["kristin-flickinger", "Kristin Flickinger", 49, "Crisis management professional", "Santa Barbara, CA", "A joyful, determined problem-solver with experience staying calm when stakes rise."],
  ["lewis-kelly", "Lewis Kelly", 28, "Farmer", "Puerto Rico", "A cheeky and charming farmer ready to combine grit with an international perspective."],
  ["linnea-capobianco", "Linnea Capobianco", 25, "Entrepreneur", "Jersey City, NJ", "A rational optimist who is comfortable making decisions and backing them up."],
  ["maggie-nestor", "Maggie Nestor", 40, "Farmer", "Charles Town, WV", "A joyful, intentional farmer whose practical skills should translate naturally to camp life."],
  ["michael-pinsky", "Mike Pinsky", 32, "Baseball executive", "New York, NY", "An enthusiastic strategist who studies performance, patterns, and competitive edges."],
  ["ori-jean-charles", "Ori Jean-Charles", 27, "Personal trainer", "Spring Valley, NY", "A consistent physical threat who plans to pair discipline with a strong social game."],
  ["patt-cannaday", "Patt Cannaday", 33, "Federal prosecutor", "Washington, DC", "A loyal, intense attorney who brings analysis, discipline, and a sense of humor."],
  ["rob-antonson", "Rob Antonson", 40, "Airline gate agent", "Cumberland, RI", "A funny, competitive operator who is accustomed to keeping people moving under pressure."],
  ["sharonda-renee", "Sharonda Cox", 34, "OB-GYN resident", "Richmond, KY", "A charismatic and resilient physician experienced with consequential decisions."],
] as const;

export const castaways: Castaway[] = officialCast.map(([id, name, age, job, hometown, bio]) => ({
  id,
  name,
  age,
  job,
  hometown,
  tribe: "Unassigned",
  bio,
  image: `/cast/${id}.jpg`,
}));

export const tribeOptions = [
  { id: "savu", name: "Savu", color: "Purple tribe" },
  { id: "toka", name: "Toka", color: "Yellow tribe" },
];
