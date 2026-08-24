export type Castaway = { id: string; name: string; age: number; job: string; hometown: string; tribe: "Savu" | "Toka"; bio: string; image: string; status?: string };

export const castaways: Castaway[] = [
  ["aaliyah-puglia","Aaliyah Puglia",25,"Chef","Providence, RI","Savu","A creative competitor who knows how to perform under pressure."],
  ["alexis-levine","Alexis Levine",28,"Defense attorney","Atlanta, GA","Toka","A persuasive strategist comfortable reading a room."],
  ["angelica-loblack","Angelica “Jelly” Loblack",29,"Sociology professor","Bloomington, IN","Savu","A people-watcher ready to turn social insight into leverage."],
  ["ana-sani","Ana Sani",34,"Actor & voice actor","Toronto, ON","Toka","An expressive player with adaptability and quick instincts."],
  ["brady-booker","Brady Booker",26,"Professional wrestler","Atlanta, GA","Savu","A bold physical presence who understands performance and alliances."],
  ["carter-krull","Carter Krull",25,"Farmer","Rock Rapids, IA","Toka","Practical, steady, and accustomed to long days of hard work."],
  ["cristian-chavez","Cristian Chavez",25,"HR executive","Salt Lake City, UT","Savu","A relationship builder who plans to keep camp connected."],
  ["daniel-kilby","Daniel Kilby",28,"Game studio founder","London, ON","Toka","A systems thinker who loves puzzles, risk, and game theory."],
  ["devin-way","Devin Way",33,"Actor & model","Lufkin, TX","Savu","Charismatic and composed, with an eye for the big moment."],
  ["eric-macksoud","Eric Macksoud",34,"Mental health therapist","Sunderland, MA","Toka","An empathetic listener who may hear more than people intend."],
  ["jenna-greenawalt","Jenna Greenawalt",31,"Wedding photographer","Maumee, OH","Savu","Observant, social, and ready to capture every shift in the game."],
  ["kristin-flickinger","Kristin Flickinger",49,"Nonprofit consultant","Santa Barbara, CA","Toka","A seasoned organizer with patience and coalition-building skills."],
  ["lewis-kelly","Lewis Kelly",28,"Digital creator","Dublin, Ireland","Savu","An energetic storyteller with an international perspective."],
  ["linnea-capobianco","Linnea Capobianco",26,"Business owner","Kearny, NJ","Toka","Direct, entrepreneurial, and comfortable making tough calls."],
  ["maggie-nestor","Maggie Nestor",40,"Camp counselor & farmer","Charles Town, WV","Savu","Built for camp life, group dynamics, and gritty challenges."],
  ["michael-pinsky","Michael Pinsky",32,"Baseball operations","New York, NY","Toka","A numbers-minded competitor who studies performance and patterns."],
  ["ori-jean-charles","Ori Jean-Charles",27,"Personal trainer","Monsey, NY","Savu","A physical threat whose youth work keeps people at the center."],
  ["patt-cannaday","Patt Cannaday",33,"Attorney & Navy reservist","Norfolk, VA","Toka","Disciplined, analytical, and prepared for pressure."],
  ["rob-antonson","Rob Antonson",40,"Airport operations","Boston, MA","Savu","Calm in complex situations and used to keeping teams moving."],
  ["sharonda-renee","Sharonda Renee",34,"OB-GYN physician","Berea, KY","Toka","Decisive, resilient, and experienced when stakes are high."],
  ["thien-an-nguyen","Thien An Nguyen",25,"Medical student","Fort Worth, TX","Savu","Curious, driven, and ready to diagnose the game around him."],
].map(([id,name,age,job,hometown,tribe,bio]) => ({ id: id as string, name: name as string, age: age as number, job: job as string, hometown: hometown as string, tribe: tribe as "Savu"|"Toka", bio: bio as string, image: `/cast/${id}.${id === "ori-jean-charles" ? "jpg" : "png"}` }));

export const tribeOptions = [
  { id: "savu", name: "Savu", color: "Purple tribe" },
  { id: "toka", name: "Toka", color: "Yellow tribe" },
];
