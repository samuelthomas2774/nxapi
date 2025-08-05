import { Title } from '../types.js';
import SplatNet3Monitor, { callback as SplatNet3ActivityCallback } from '../monitor/splatoon3.js';

export const titles: Title[] = [
    {
        // Splatoon 2 [Europe]
        id: '0100f8f0000a2000',
        client: '950886725398429726',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Splatoon 2 [The Americas]
        id: '01003bc0000a0000',
        client: '950886725398429726',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Splatoon 2 [Japan]
        id: '01003c700009c000',
        client: '950886725398429726',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Splatoon 2 Global Testfire [The Americas]
        id: '010000a00218e000',
        client: '950886725398429726',
        largeImageText: 'Global Testfire',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2: Splatfest World Premiere [Europe]
        id: '010086f0040fc000',
        client: '950886725398429726',
        largeImageText: 'Splatfest World Premiere',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2: Splatfest World Premiere [The Americas]
        id: '01003870040fa000',
        client: '950886725398429726',
        largeImageText: 'Splatfest World Premiere',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2: Splatfest World Premiere [Japan] ???
        id: '0100d070040f8000',
        client: '950886725398429726',
        largeImageText: 'Splatfest World Premiere',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2: Special Demo [Europe]
        id: '01007e200d45c000',
        client: '950886725398429726',
        largeImageText: 'Special Demo',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2 Special Demo [The Americas]
        id: '01006bb00d45a000',
        client: '950886725398429726',
        largeImageText: 'Special Demo',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2 Special Demo [Japan]
        id: '01009c900d458000',
        client: '950886725398429726',
        largeImageText: 'Special Demo',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2: Special Demo 2020 [Europe]
        id: '01009240116cc000',
        client: '950886725398429726',
        largeImageText: 'Special Demo 2020',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2 Special Demo 2020 [The Americas]
        id: '01002120116c4000',
        client: '950886725398429726',
        largeImageText: 'Special Demo 2020',
        showPlayingOnline: true,
    },
    {
        // Splatoon 2 Special Demo 2020 [Japan]
        id: '0100998011330000',
        client: '950886725398429726',
        largeImageText: 'Special Demo 2020',
        showPlayingOnline: true,
    },

    {
        // Super Smash Bros. Ultimate
        id: '01006a800016e000',
        client: '950894516104212490',
        showActiveEvent: true,
    },

    {
        // Mario Kart 8 Deluxe
        id: '0100152000022000',
        client: '950905573149409280',
        showActiveEvent: true,
    },

    {
        // Super Mario Odyssey
        id: '0100000000010000',
        client: '950905939899351050',
    },

    {
        // Nintendo Entertainment System - Nintendo Switch Online
        id: '0100d870045b6000',
        client: '950907272438104064',
        largeImageText: 'Nintendo Entertainment System',
    },
    {
        // ファミリーコンピュータ Nintendo Switch Online
        id: '0100b4e00444c000',
        client: '950907272438104064',
        largeImageText: 'ファミリーコンピュータ',
    },
    {
        // Super Nintendo Entertainment System - Nintendo Switch Online
        id: '01008d300c50c000',
        client: '950907272438104064',
        largeImageText: 'Super Nintendo Entertainment System',
    },
    {
        // スーパーファミコン Nintendo Classics [SNES JP/HK]
        id: '0100e8600c504000',
        client: '950907272438104064',
        largeImageText: 'スーパーファミコン',
    },
    {
        // Nintendo 64 - Nintendo Switch Online
        id: '0100c9a00ece6000',
        client: '950907272438104064',
        largeImageText: 'Nintendo 64',
    },
    {
        // NINTENDO 64 Nintendo Classics [JP/HK]
        id: '010057d00ece4000',
        client: '950907272438104064',
        largeImageText: 'Nintendo 64',
    },
    {
        // Nintendo 64 – Nintendo Classics: Mature
        id: '0100e0601c632000',
        client: '950907272438104064',
        largeImageText: 'Nintendo 64',
    },
    {
        // NINTENDO 64 Nintendo Switch Online 18+ [JP/HK]
        id: '010037a0170d2000',
        client: '950907272438104064',
        largeImageText: 'Nintendo 64',
    },
    {
        // SEGA Mega Drive - Nintendo Switch Online
        id: '0100b3c014bda000',
        client: '950907272438104064',
        largeImageText: 'SEGA Mega Drive',
    },
    {
        // セガ メガドライブ for Nintendo Switch Online [SEGA Mega Drive JP/HK]
        id: '01001ea014bcc000',
        client: '950907272438104064',
        largeImageText: 'セガ メガドライブ',
    },
    {
        // Game Boy - Nintendo Switch Online
        id: '0100c62011050000',
        client: '950907272438104064',
        largeImageText: 'Game Boy',
    },
    {
        // ゲームボーイ Nintendo Switch Online
        id: '0100395011044000',
        client: '950907272438104064',
        largeImageText: 'ゲームボーイ',
    },
    {
        // Game Boy Advance - Nintendo Switch Online
        id: '010012f017576000',
        client: '950907272438104064',
        largeImageText: 'Game Boy Advance',
    },
    {
        // ゲームボーイアドバンス Nintendo Switch Online [GBA JP/HK]
        id: '0100555017574000',
        client: '950907272438104064',
        largeImageText: 'ゲームボーイアドバンス',
    },
    {
        // Nintendo GameCube – Nintendo Classics
        id: '040029a01d3e0000',
        client: '950907272438104064',
        largeImageText: 'Nintendo GameCube',
    },
    {
        // ニンテンドー ゲームキューブ Nintendo Classics [GC JP/HK]
        id: '040052e01d3da000',
        client: '950907272438104064',
        largeImageText: 'ニンテンドー ゲームキューブ',
    },

    {
        // Animal Crossing: New Horizons
        id: '01006f8002326000',
        client: '950908097235415079',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Animal Crossing: New Horizons Island Transfer Tool
        id: '0100f38011cfe000',
        client: '950908097235415079',
        titleName: 'Island Transfer Tool',
    },

    {
        // The Legend of Zelda: Breath of the Wild
        id: '01007ef00011e000',
        client: '966102432838996009',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // 1-2-Switch
        id: '01000320000cc000',
        client: '966102630524919848',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Snipperclips - Cut it out, together!
        id: '0100704000b3a000',
        client: '966102704525025301',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Snipperclips - Cut it out, together! Demo
        id: '0100d87002ee0000',
        client: '966102704525025301',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // ARMS
        id: '01009b500007c000',
        client: '966102773642960917',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // ARMS Global Testpunch
        id: '0100c5e003b40000',
        client: '966102773642960917',
        largeImageText: 'Global Testpunch',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // ARMS Sparring Demo
        id: '0100a5400ac86000',
        client: '966102773642960917',
        largeImageText: 'Sparring Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokémon: Let's Go, Pikachu!
        id: '010003f003a34000',
        client: '966102993177034832',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokémon: Let's Go, Eevee!
        id: '0100187003a36000',
        client: '966103072407437332',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokémon: Let's Go, Pikachu! & Pokémon: Let's Go, Eevee! Demo
        id: '0100c1800d7ae000',
        client: '966103072407437332',
        largeImageText: 'Pokémon: Let\'s Go, Pikachu! & Pokémon: Let\'s Go, Eevee! Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Fire Emblem Warriors
        id: '0100f15003e64000',
        client: '966103152753528942',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Xenoblade Chronicles 2
        id: '0100e95004038000',
        client: '966103273612382248',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Yoshi's Crafted World
        id: '01006000040c2000',
        client: '966103360589672488',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Yoshi's Crafted World Demo
        id: '0100ae800c9c6000',
        client: '966103360589672488',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokkén Tournament DX
        id: '0100b3f000be2000',
        client: '966103482702647326',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokkén Tournament DX Demo
        id: '010030d005ae6000',
        client: '966103482702647326',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Octopath Traveler
        id: '010057d006492000',
        client: '966147770006241340',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // OCTOPATH TRAVELER: Prologue Demo
        id: '010096000b3ea000',
        client: '966147770006241340',
        largeImageText: 'Prologue Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Luigi's Mansion 3
        id: '0100dca0064a6000',
        client: '966147956078178364',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Captain Toad: Treasure Tracker
        id: '01009bf0072d4000',
        client: '966148067134939186',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Captain Toad: Treasure Tracker Demo
        id: '01002c400b6b6000',
        client: '966148067134939186',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Sushi Striker: The Way of Sushido
        id: '0100ddd0085a4000',
        client: '966148228154265661',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // Sushi Striker: The Way of Sushido Demo
    //     id: '', // TODO
    //     client: '966148228154265661',
    //     largeImageText: 'Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // Mario Tennis Aces
        id: '0100bde00862a000',
        client: '966148353727561738',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Mario Tennis Aces: Special Demo [Europe]
        id: '0100f9600da78000',
        client: '966148353727561738',
        largeImageText: 'Special Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Mario Tennis Aces Special Online Demo [The Americas]
        id: '0100a4200da76000',
        client: '966148353727561738',
        largeImageText: 'Special Online Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokémon Shield
        id: '01008db008c2c000',
        client: '966148552768249866',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokémon Sword
        id: '0100abf008968000',
        client: '966148667201445928',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pikmin 3 Deluxe
        id: '0100f4c009322000',
        client: '966148753365041173',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pikmin 3 Deluxe Demo
        id: '01001cb0106f8000',
        client: '966148753365041173',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Dragon Quest Builders
        id: '010008900705c000',
        client: '966148914933792838',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Dragon Quest Builders Demo
        id: '0100c360070f6000',
        client: '966148914933792838',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Hyrule Warriors: Definitive Edition
        id: '0100ae00096ea000',
        client: '966149007959281755',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // New Super Mario Bros. U Deluxe
        id: '0100ea80032ea000',
        client: '966329678715559996',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Bayonetta 2
        id: '01007960049a0000',
        client: '966329813780549672',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Bayonetta
        id: '010076f0049a2000',
        client: '966329937533497364',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Kirby Star Allies
        id: '01007e3006dda000',
        client: '966330020391952384',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Kirby Star Allies Demo
        id: '01005a70096fa000',
        client: '966330020391952384',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Fire Emblem: Three Houses
        id: '010055d009f78000',
        client: '966330114210152528',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // The Stretchers
        id: '0100aa400a238000',
        client: '966331256541429831',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Donkey Kong Country: Tropical Freeze
        id: '0100c1f0051b6000',
        client: '966331402289315850',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Dragon Quest Builders 2
        id: '010042000a986000',
        client: '966331488322871346',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // Dragon Quest Builders 2 Demo
    //     id: '', // TODO
    //     client: '966331488322871346',
    //     largeImageText: 'Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },
    // {
    //     // Dragon Quest Builders 2 Jumbo Demo
    //     id: '', // TODO
    //     client: '966331488322871346',
    //     largeImageText: 'Jumbo Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // Go Vacation
        id: '0100c1800a9b6000',
        client: '966331633244471306',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Fitness Boxing
        id: '0100e7300aad4000',
        client: '966387481375285300',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Fitness Boxing Demo
        id: '010050200d0da000',
        client: '966387481375285300',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Marvel Ultimate Alliance 3: The Black Order
        id: '010060700ac50000',
        client: '966387596173389864',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // The World Ends With You: -Final Remix-
        id: '0100c1500b82e000',
        client: '966387699344896073',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Mario Kart Live: Home Circuit
        id: '0100ed100ba3a000',
        client: '966387799718768690',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokémon Mystery Dungeon: Rescue Team DX
        id: '01003d200baa2000',
        client: '966387876520685668',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokémon Mystery Dungeon: Rescue Team DX Demo
        id: '010040800fb54000',
        client: '966387876520685668',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Mario Party
        id: '010036b0034e4000',
        client: '966387972574429184',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // DAEMON X MACHINA
        id: '0100b6400ca56000',
        client: '966388060428320789',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // DAEMON X MACHINA: Prototype Missions
        id: '0100bf600d83a000',
        client: '966388060428320789',
        largeImageText: 'Prototype Missions',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // DAEMON X MACHINA Demo
    //     id: '', // TODO
    //     client: '966388060428320789',
    //     largeImageText: 'Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // TETRIS 99
        id: '010040600c5ce000',
        client: '966388175465496626',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Mario Maker 2
        id: '01009b90006dc000',
        client: '966388261264162836',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // BOXBOY! + BOXGIRL!
        id: '010018300d006000',
        client: '966388339127234592',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // BOXBOY! + BOXGIRL! Demo
        id: '0100b7200e02e000',
        client: '966388339127234592',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Astral Chain
        id: '01007300020fa000',
        client: '966441561158213662',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // The Legend of Zelda: Link's Awakening
        id: '01006bb00c6f0000',
        client: '966441660210872441',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Cadence of Hyrule - Crypt of the NecroDancer Featuring The Legend of Zelda
        id: '01000b900d8b0000',
        client: '966441763973763162',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Cadence of Hyrule - Crypt of the NecroDancer Featuring The Legend of Zelda Demo
        id: '010065700ee06000',
        client: '966441763973763162',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Dragon Quest XI S: Echoes of an Elusive Age - Definitive Edition
        id: '01006c300e9f0000',
        client: '966441876267864084',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Dragon Quest XI S: Echoes of an Elusive Age - Definitive Edition [Demo version]
        id: '010026800ea0a000',
        client: '966441876267864084',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Kirby Clash
        id: '01003fb00c5a8000',
        client: '966442004026380368',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Tokyo Mirage Sessions #FE Encore
        id: '0100a9400c9c2000',
        client: '966442166526308463',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Dr Kawashima's Brain Training for Nintendo Switch
        id: '0100ed000d390000',
        client: '966442282372964372',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Bravely Default II
        id: '01006dc010326000',
        client: '966442378095382578',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Bravely Default II Demo
        id: '0100b6801137e000',
        client: '966442378095382578',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // Bravely Default II Demo
    //     id: '', // TODO - there's two demos apparently
    //     client: '966442378095382578',
    //     largeImageText: 'Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // Xenoblade Chronicles: Definitive Edition
        id: '0100ff500e34a000',
        client: '966442512984191076',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // 51 Worldwide Games
        id: '010047700d540000',
        client: '966442617938280526',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // 51 Worldwide Games: Local Multiplayer Guest Edition
        id: '0100cd9011c04000',
        client: '966442617938280526',
        largeImageText: 'Local Multiplayer Guest Edition',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Good Job!
        id: '0100b0500fe4e000',
        client: '966478025006919680',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Paper Mario: The Origami King
        id: '0100a3900c3e2000',
        client: '966478424195600385',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Mario 3D All-Stars
        id: '010049900f546000',
        client: '966478641473130506',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Jump Rope Challenge
        id: '0100b9c012706000',
        client: '966478825707937822',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Mario 3D World + Bowser's Fury
        id: '010028600ebda000',
        client: '966478958868693042',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Kirby Fighters 2
        id: '0100227010460000',
        client: '966479069287960656',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // Kirby Fighters 2 Demo
    //     id: '', // TODO
    //     client: '966479069287960656',
    //     largeImageText: 'Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // Hyrule Warriors: Age of Calamity
        id: '01002b00111a2000',
        client: '966479236762325013',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Hyrule Warriors: Age of Calamity - Demo Version
        id: '0100a2c01320e000',
        client: '966479236762325013',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Fitness Boxing 2: Rhythm & Exercise
        id: '0100073011382000',
        client: '966479353510789150',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Fitness Boxing 2: Rhythm & Exercise Demo
        id: '01000f50130a2000',
        client: '966479353510789150',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Part Time UFO
        id: '01006b5012b32000',
        client: '966479489745944737',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // New Pokémon Snap
        id: '0100f4300bf2c000',
        client: '966479643039399977',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // The Legend of Zelda: Skyward Sword HD
        id: '01002da013484000',
        client: '966487001119473734',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Miitopia
        id: '01003da010e8a000',
        client: '966487135194591282',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Miitopia Demo
        id: '01007da0140e8000',
        client: '966487135194591282',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Mario Golf: Super Rush
        id: '0100c9c00e25c000',
        client: '966487238944882759',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokémon Legends: Arceus
        id: '01001f5010dfa000',
        client: '966487348743372850',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokémon Brilliant Diamond
        id: '0100000011d90000',
        client: '966487430981111818',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokémon Shining Pearl
        id: '010018e011d92000',
        client: '966487507392933929',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Game Builder Garage
        id: '0100fa5010788000',
        client: '966487590721163264',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Game Builder Garage Demo
        id: '01003b101497c000',
        client: '966487590721163264',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Metroid Dread
        id: '010093801237c000',
        client: '966487674162642974',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // Metroid Dread Demo
    //     id: '', // TODO
    //     client: '966487674162642974',
    //     largeImageText: 'Demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // WarioWare: Get It Together!
        id: '0100563010e0c000',
        client: '966487765447483412',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // WarioWare: Get It Together! Demo
        id: '0100ee9015b5e000',
        client: '966487765447483412',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Mario Party Superstars
        id: '01006fe013472000',
        client: '966487877343125584',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Advance Wars 1+2: Re-Boot Camp
        id: '0100300012f2a000',
        client: '966533261541113857',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Shin Megami Tensei V
        id: '0100b870126ce000',
        client: '966533545843650570',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Big Brain Academy: Brain vs. Brain
        id: '0100620012d6e000',
        client: '966533636969082921',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Big Brain Academy: Brain vs. Brain Demo
        id: '0100219016ab4000',
        client: '966533636969082921',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Triangle Strategy
        id: '0100cc80140f8000',
        client: '966533747023437904',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Project Triangle Strategy Debut Demo
        id: '01002980140f6000',
        client: '966533747023437904',
        largeImageText: 'Project Triangle Strategy Debut Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    // {
    //     // Project Triangle Strategy Prologue demo
    //     id: '', // TODO
    //     client: '966533747023437904',
    //     largeImageText: 'Prologue demo',
    //     showPlayingOnline: true,
    //     showActiveEvent: true,
    // },

    {
        // Kirby and the Forgotten Land
        id: '01004d300c5ae000',
        client: '966534055116021821',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Kirby and the Forgotten Land Demo
        id: '010091201605a000',
        client: '966534055116021821',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Nintendo Switch Sports
        id: '0100d2f00d5c0000',
        client: '966534181783998474',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Nintendo Switch Sports Online Play Test
        id: '01000ee017182000',
        client: '966534181783998474',
        largeImageText: 'Online Play Test',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Mario Strikers: Battle League Football
        id: '010019401051c000',
        client: '966534341662482462',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Mario Strikers: Battle League Football - First Kick
        id: '01008a30182f2000',
        client: '966534341662482462',
        largeImageText: 'First Kick',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Fire Emblem Warriors: Three Hopes
        id: '010071f0143ea000',
        client: '966534448168439872',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Fire Emblem Warriors: Three Hopes Demo
        id: '01006e6017792000',
        client: '966534448168439872',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Live A Live
        id: '0100cf801776c000',
        client: '966534559929860167',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Live A Live Demo
        id: '0100a5f017e9e000',
        client: '966534559929860167',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Xenoblade Chronicles 3
        id: '010074f013262000',
        client: '967103709605658735',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Splatoon 3
        id: '0100c2500fc20000',
        client: '967103796134158447',
        monitor: SplatNet3Monitor,
        callback: SplatNet3ActivityCallback,
    },
    {
        // Splatoon 3: Splatfest World Premiere
        id: '0100ba0018500000',
        client: '967103796134158447',
        largeImageText: 'Splatfest World Premiere',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Bayonetta 3
        id: '01004a4010fea000',
        client: '1037891425318215820',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pokémon Scarlet
        id: '0100a3d008c5c000',
        client: '1037891706483384360',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pokémon Violet
        id: '01008f6008c5e000',
        client: '1037891823286366288',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Fire Emblem Engage
        id: '0100a6301214e000',
        client: '1037891927430922391',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Kirby's Return to Dream Land Deluxe
        id: '01006b601380e000',
        client: '1037892083748446278',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Bayonetta Origins: Cereza and the Lost Demon
        id: '0100cf5010fec000',
        client: '1107032391496761375',
        titleName: 'Bayonetta Origins: Cereza and the Lost Demon',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Bayonetta Origins: Cereza and the Lost Demon Demo
        id: '010002801a3fa000',
        client: '1107032391496761375',
        largeImageText: 'Bayonetta Origins: Cereza and the Lost Demon Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // The Legend of Zelda: Tears of the Kingdom
        id: '0100f2c0115b6000',
        client: '1107033191912579183',
        largeImageText: 'The Legend of Zelda: Tears of the Kingdom',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pikmin 4
        id: '0100b7c00933a000',
        client: '1107033455755264010',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pikmin 4 Demo
        id: '0100e0b019974000',
        client: '1107033455755264010',
        largeImageText: 'Demo',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Metroid Prime Remastered
        id: '010012101468c000',
        client: '1107120929953284150',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Pikmin 1
        id: '0100aa80194b0000',
        client: '1121121911229927476',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
    {
        // Pikmin 2
        id: '0100d680194b2000',
        client: '1121122602782576640',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Everybody 1-2-Switch!
        id: '01006f900bf8e000',
        client: '1121122719019323413',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Mario Bros. Wonder
        id: '010015100b514000',
        client: '1121122895519813642',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // WarioWare: Move It!
        id: '010045b018ec2000',
        client: '1121123023961985054',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Super Mario RPG
        id: '0100bc0018138000',
        client: '1121123106942095522',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // Detective Pikachu Returns
        id: '010007500f27c000',
        client: '1121123195882307604',
        showPlayingOnline: true,
        showActiveEvent: true,
    },

    {
        // F-ZERO 99
        id: '0100ccf019c8c000',
        client: '1167145130294255637',
        showPlayingOnline: true,
        showActiveEvent: true,
    },
];
