import {
  catalogSchema,
  type CatalogItem,
  type ReleaseStatus,
  type Route,
} from "../domain/catalog.js"

const movie = (
  id: string,
  title: string,
  year: number,
  releaseStatus: ReleaseStatus = "released",
): Omit<CatalogItem, "order"> => ({
  id,
  title,
  year,
  releaseStatus,
  route: "movies",
  kind: "movie",
})

const show = (
  id: string,
  title: string,
  year: number,
  seasonEpisodeCounts: number[] | undefined,
  releaseStatus: ReleaseStatus = "released",
  kind: "series" | "special" = "series",
): Omit<CatalogItem, "order"> => ({
  id,
  title,
  year,
  releaseStatus,
  route: "series",
  kind,
  ...(seasonEpisodeCounts ? { seasonEpisodeCounts } : {}),
})

const withOrder = (
  items: Omit<CatalogItem, "order">[],
): CatalogItem[] => items.map((item, index) => ({ ...item, order: index + 1 }))

const movies = withOrder([
  movie("iron-man", "Iron Man", 2008),
  movie("the-incredible-hulk", "The Incredible Hulk", 2008),
  movie("iron-man-2", "Iron Man 2", 2010),
  movie("thor", "Thor", 2011),
  movie("captain-america-the-first-avenger", "Captain America: The First Avenger", 2011),
  movie("the-avengers", "The Avengers", 2012),
  movie("iron-man-3", "Iron Man 3", 2013),
  movie("thor-the-dark-world", "Thor: The Dark World", 2013),
  movie("captain-america-the-winter-soldier", "Captain America: The Winter Soldier", 2014),
  movie("guardians-of-the-galaxy", "Guardians of the Galaxy", 2014),
  movie("avengers-age-of-ultron", "Avengers: Age of Ultron", 2015),
  movie("ant-man", "Ant-Man", 2015),
  movie("captain-america-civil-war", "Captain America: Civil War", 2016),
  movie("doctor-strange", "Doctor Strange", 2016),
  movie("guardians-of-the-galaxy-vol-2", "Guardians of the Galaxy Vol. 2", 2017),
  movie("spider-man-homecoming", "Spider-Man: Homecoming", 2017),
  movie("thor-ragnarok", "Thor: Ragnarok", 2017),
  movie("black-panther", "Black Panther", 2018),
  movie("avengers-infinity-war", "Avengers: Infinity War", 2018),
  movie("ant-man-and-the-wasp", "Ant-Man and the Wasp", 2018),
  movie("captain-marvel", "Captain Marvel", 2019),
  movie("avengers-endgame", "Avengers: Endgame", 2019),
  movie("spider-man-far-from-home", "Spider-Man: Far From Home", 2019),
  movie("black-widow", "Black Widow", 2021),
  movie("shang-chi", "Shang-Chi and the Legend of the Ten Rings", 2021),
  movie("eternals", "Eternals", 2021),
  movie("spider-man-no-way-home", "Spider-Man: No Way Home", 2021),
  movie("doctor-strange-multiverse-of-madness", "Doctor Strange in the Multiverse of Madness", 2022),
  movie("thor-love-and-thunder", "Thor: Love and Thunder", 2022),
  movie("black-panther-wakanda-forever", "Black Panther: Wakanda Forever", 2022),
  movie("ant-man-and-the-wasp-quantumania", "Ant-Man and the Wasp: Quantumania", 2023),
  movie("guardians-of-the-galaxy-vol-3", "Guardians of the Galaxy Vol. 3", 2023),
  movie("the-marvels", "The Marvels", 2023),
  movie("deadpool-and-wolverine", "Deadpool & Wolverine", 2024),
  movie("captain-america-brave-new-world", "Captain America: Brave New World", 2025),
  movie("thunderbolts", "Thunderbolts*", 2025),
  movie("fantastic-four-first-steps", "The Fantastic Four: First Steps", 2025),
  movie("spider-man-brand-new-day", "Spider-Man: Brand New Day", 2026),
  movie("avengers-doomsday", "Avengers: Doomsday", 2026, "upcoming"),
])

const series = withOrder([
  show("daredevil", "Daredevil", 2015, [13, 13, 13]),
  show("jessica-jones", "Jessica Jones", 2015, [13, 13, 13]),
  show("luke-cage", "Luke Cage", 2016, [13, 13]),
  show("iron-fist", "Iron Fist", 2017, [13, 10]),
  show("the-defenders", "The Defenders", 2017, [8]),
  show("the-punisher", "The Punisher", 2017, [13, 13]),
  show("wandavision", "WandaVision", 2021, [9]),
  show("falcon-and-winter-soldier", "The Falcon and the Winter Soldier", 2021, [6]),
  show("loki", "Loki", 2021, [6, 6]),
  show("hawkeye", "Hawkeye", 2021, [6]),
  show("moon-knight", "Moon Knight", 2022, [6]),
  show("ms-marvel", "Ms. Marvel", 2022, [6]),
  show("she-hulk", "She-Hulk: Attorney at Law", 2022, [9]),
  show("werewolf-by-night", "Werewolf by Night", 2022, [1], "released", "special"),
  show("guardians-holiday-special", "The Guardians of the Galaxy Holiday Special", 2022, [1], "released", "special"),
  show("secret-invasion", "Secret Invasion", 2023, [6]),
  show("echo", "Echo", 2024, [5]),
  show("agatha-all-along", "Agatha All Along", 2024, [9]),
  show("daredevil-born-again", "Daredevil: Born Again", 2025, [9]),
  show("ironheart", "Ironheart", 2025, [6]),
  show("wonder-man", "Wonder Man", 2026, [8]),
  show("daredevil-born-again-season-2", "Daredevil: Born Again — Season 2", 2026, [8]),
  show("punisher-one-last-kill", "The Punisher: One Last Kill", 2026, [1], "released", "special"),
  show("visionquest", "VisionQuest", 2026, undefined, "upcoming"),
])

export const catalog = catalogSchema.parse([...movies, ...series])

export function getRouteItems(route: Route): CatalogItem[] {
  return catalog
    .filter((item) => item.route === route)
    .sort((a, b) => a.order - b.order)
}
