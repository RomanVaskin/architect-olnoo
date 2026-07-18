export type Project = {
  id: string;
  title: string;
  location: string;
  status: "In design" | "Review" | "Draft";
  progress: number;
  updated: string;
  tone: "light" | "dark" | "wood";
};

export const projects: Project[] = [
  { id: "pine-ridge", title: "Pine Ridge House", location: "Ontario, Canada", status: "In design", progress: 68, updated: "12 min ago", tone: "light" },
  { id: "fjord-cabin", title: "Fjord Cabin", location: "Bergen, Norway", status: "Review", progress: 84, updated: "Yesterday", tone: "dark" },
  { id: "lake-house", title: "Lake House", location: "Karelia, Russia", status: "Draft", progress: 24, updated: "3 days ago", tone: "wood" },
];

export const concepts = [
  { id: "a", name: "Nordic light", note: "Natural oak · lime render", tone: "light", score: 94 },
  { id: "b", name: "Forest graphite", note: "Charred timber · stone", tone: "dark", score: 91 },
  { id: "c", name: "Warm modern", note: "Thermowood · dark metal", tone: "wood", score: 88 },
];
