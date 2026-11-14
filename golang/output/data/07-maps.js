window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "07-maps",
  "order": 7,
  "title": "Maps",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "A map stores values that you look up by a key, like a dictionary or a phone contact list. You will create maps, tell a missing key apart from a stored zero, add, change and delete entries, print in a stable order, and build sets. Maps are used everywhere in real Go programs for counting, caching and lookup by ID.",
  "prerequisites": [
    "06-arrays-slices"
  ],
  "subtopics": [
    {
      "id": "creating-maps",
      "title": "Creating maps",
      "explanation": "A map is a collection that links each key to a value. You give the map a key and it hands back the value stored for that key. In Go the type is written map[K]V, where K is the key type and V is the value type. So map[string]int links text keys (string) to whole-number values (int).\n\nThe quickest way to make one is a map literal, which is a map written out directly in the code: map[string]int{\"ann\": 31, \"bob\": 25}. You read a value with square brackets, ages[\"ann\"], and len(ages) gives the number of entries.\n\nWhen you want an empty map to fill later, use the built-in make: make(map[string]int). make creates the map ready for use.\n\nKeys must be comparable, which means Go can check two keys with == to see if they are equal. Strings, numbers and bools are comparable. A slice is not comparable, so using a slice as a key is a compile error (Go refuses to build the program).\n\nThere is also the nil map. A variable declared as var m map[string]int has the zero value nil, meaning no map exists yet. Reading from a nil map is safe: you get the zero value of the value type, and len is 0. Writing to a nil map causes a panic, which is a crash where Go stops the program and prints an error message. Always create the map with a literal or make before writing.",
      "analogy": "A map is like the contacts app on your phone. You type a name (the key) and it shows a number (the value). Every name appears once, and looking up a name you never saved simply finds nothing. A nil map is like a phone that has no contacts app installed yet: you can ask it for a name and get nothing, but you cannot save a new contact until you install the app (make the map).",
      "code": [
        {
          "language": "go",
          "filename": "mk.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tages := map[string]int{\"ann\": 31, \"bob\": 25}\n\tfmt.Println(ages[\"ann\"], len(ages))\n\n\tcounts := make(map[string]int)\n\tcounts[\"go\"] = 1\n\tfmt.Println(counts, len(counts))\n\n\tvar nothing map[string]int\n\tfmt.Println(nothing[\"x\"], len(nothing), nothing == nil)\n}\n",
          "output": "31 2\nmap[go:1] 1\n0 0 true",
          "explanation": "The literal creates a map with two entries, so ages[\"ann\"] is 31 and len is 2. make creates an empty map that we fill with counts[\"go\"] = 1. The variable nothing is a nil map: reading nothing[\"x\"] gives 0 (the zero value of int), its length is 0, and comparing it to nil is true."
        },
        {
          "language": "go",
          "filename": "nilwrite.go",
          "source": "package main\n\nfunc main() {\n\tvar m map[string]int\n\tm[\"a\"] = 1\n}\n",
          "output": "panic: assignment to entry in nil map\n\ngoroutine 1 [running]:\nmain.main()\n\t...",
          "explanation": "Writing to a map that was never created panics. The first line of the message is the important part. The lines after it show where in the program the crash happened and vary with your file path. Fix it with m := make(map[string]int) or a literal."
        }
      ],
      "productionNote": "Maps are the standard tool for caches, counting how often things appear, and looking up records by ID. If you know roughly how many entries you will add, make(map[string]int, 1000) takes an optional size hint that avoids repeated growing while you fill it.",
      "commonMistakes": [
        "Writing to a nil map (var m map[string]int then m[\"a\"] = 1) panics with 'assignment to entry in nil map'. Create the map with make or a literal first.",
        "Using a slice as a key, for example map[[]int]string, does not compile because slices are not comparable. Use a string, number, or array instead."
      ],
      "sources": [
        {
          "title": "The Go Specification: Map types",
          "url": "https://go.dev/ref/spec#Map_types"
        },
        {
          "title": "Go maps in action",
          "url": "https://go.dev/blog/maps"
        }
      ]
    },
    {
      "id": "comma-ok",
      "title": "Reading with comma-ok",
      "explanation": "When you read a key that is not in the map, Go does not stop with an error. It returns the zero value of the value type: 0 for int, \"\" for string, false for bool. That creates a problem: if ages[\"zoe\"] returns 0, you cannot tell whether Zoe is missing or Zoe is stored with age 0.\n\nThe comma-ok form solves this. Write v, ok := ages[\"zoe\"]. You now get two results: v is the value (or the zero value if missing) and ok is a bool that is true only if the key was really in the map. By convention the second variable is named ok.\n\nYou can combine it with an if init statement (taught in the control flow topic): if age, found := ages[\"ann\"]; found { ... }. The variables exist only inside the if and else blocks.\n\nUse comma-ok whenever a zero value is a legitimate stored value, or whenever a missing key needs different handling than a present one.",
      "analogy": "You ask a librarian for a book. If they just hand you an empty box, you cannot tell whether the library does not own the book or owns it and the box is the content. A good librarian answers twice: 'here is the book' or 'we do not have it'. The second answer (ok) is that clear yes or no.",
      "code": [
        {
          "language": "go",
          "filename": "commaok.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tages := map[string]int{\"ann\": 31, \"baby\": 0}\n\n\tv, ok := ages[\"zoe\"]\n\tfmt.Println(v, ok)\n\n\tv, ok = ages[\"baby\"]\n\tfmt.Println(v, ok)\n\n\tif age, found := ages[\"ann\"]; found {\n\t\tfmt.Println(\"ann is\", age)\n\t}\n}\n",
          "output": "0 false\n0 true\nann is 31",
          "explanation": "Both lookups return 0 for the value, but ok differs: false for the missing key \"zoe\" and true for \"baby\", who is stored with age 0. The last lookup uses an if init statement and only prints when the key exists."
        }
      ],
      "productionNote": "Cache lookups use this pattern all the time: a hit (ok is true) returns the stored value, a miss (ok is false) triggers the slow work and stores the result. It is also how you check whether a config key was set at all.",
      "commonMistakes": [
        "Treating a zero value (0, \"\", false) as 'missing'. A key can be present with a zero value; only the ok result tells you for sure.",
        "Forgetting that := needs at least one new variable on the left. To reuse v and ok, write v, ok = ages[\"baby\"] with plain =."
      ],
      "sources": [
        {
          "title": "The Go Specification: Index expressions",
          "url": "https://go.dev/ref/spec#Index_expressions"
        },
        {
          "title": "Go maps in action",
          "url": "https://go.dev/blog/maps"
        }
      ]
    },
    {
      "id": "add-update-delete",
      "title": "Adding, updating and delete",
      "explanation": "The same syntax adds and updates: m[k] = v stores v under key k. If k is new, the entry is added. If k already exists, its value is replaced.\n\nBecause a missing key reads as the zero value, you can change a number without checking first. m[k]++ on a missing key starts from 0 and stores 1. This makes counting very short: counts[word]++.\n\nTo remove an entry use the built-in delete(m, k). If the key is not there, delete does nothing and does not report an error. To remove every entry at once use the built-in clear(m), which leaves an empty map that you can keep using.\n\nWhen you print a map with fmt.Println, the output looks like map[ann:32 cy:40]. fmt sorts the keys for printing, so this output is stable. This is a feature of fmt, not of the map itself (see the next sub-topic).",
      "analogy": "Editing your phone contacts: saving a number under a name adds the contact, saving again under the same name changes the number, and deleting a contact removes it. Deleting a name you never saved is harmless. 'Clear' is wiping the whole contact list.",
      "code": [
        {
          "language": "go",
          "filename": "edit.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tages := map[string]int{\"ann\": 31, \"bob\": 25}\n\n\tages[\"cy\"] = 40\n\tages[\"ann\"]++\n\tdelete(ages, \"bob\")\n\tdelete(ages, \"nobody\")\n\n\tfmt.Println(ages, len(ages))\n}\n",
          "output": "map[ann:32 cy:40] 2",
          "explanation": "\"cy\" is added, \"ann\" goes from 31 to 32, and \"bob\" is removed. Deleting \"nobody\", which was never there, is silently ignored. fmt prints the map with keys in sorted order."
        },
        {
          "language": "go",
          "filename": "wordcount.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"strings\"\n)\n\nfunc main() {\n\twords := strings.Split(\"a b a c b a\", \" \")\n\tcounts := make(map[string]int)\n\tfor _, w := range words {\n\t\tcounts[w]++\n\t}\n\tfmt.Println(counts)\n\n\tclear(counts)\n\tfmt.Println(counts, len(counts))\n}\n",
          "output": "map[a:3 b:2 c:1]\nmap[] 0",
          "explanation": "strings.Split cuts the text at each space into a slice of words. Each counts[w]++ starts a new word at 0 and adds 1, so a appears 3 times, b twice, and c once. clear removes everything, leaving an empty map with length 0."
        }
      ],
      "productionNote": "Word counts, request counts per user, and grouping items by category are all counts[key]++ or a similar one-liner. Prefer clear(m) over making a new map when other code still holds the same map.",
      "commonMistakes": [
        "Trying to change one field of a struct (a value that groups named fields, covered in a later topic) stored in a map with m[k].X = 1. That is a compile error. Copy the value out, change it, and store it back: v := m[k]; v.X = 1; m[k] = v.",
        "Expecting delete on a missing key to fail. It does nothing, so no check is needed first."
      ],
      "sources": [
        {
          "title": "The Go Specification: Deletion of map elements",
          "url": "https://go.dev/ref/spec#Deletion_of_map_elements"
        },
        {
          "title": "builtin package: clear",
          "url": "https://pkg.go.dev/builtin#clear"
        }
      ]
    },
    {
      "id": "iteration-order",
      "title": "Iteration order is random",
      "explanation": "You loop over a map with for k, v := range m, using range just as you did with slices. Each pass gives you one key and its value.\n\nThe order is not defined. Go deliberately varies it, so two runs of the same program can visit the entries in different orders. Never write code that relies on a particular order.\n\nIf you need a stable order, for example for a report or a test, sort the keys first. The maps package has maps.Keys(m), which returns an iterator: a value that hands out the keys one by one. slices.Sorted takes such an iterator, collects the items into a new slice and sorts it. So slices.Sorted(maps.Keys(m)) gives you the sorted keys, which you can range over and use to look up values.",
      "analogy": "A map is a bag of name tags. Shake the bag and the tags come out in a different order each time. To read them alphabetically, you take all the tags out and sort them on the table first, then go through them in order.",
      "code": [
        {
          "language": "go",
          "filename": "order.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"maps\"\n\t\"slices\"\n)\n\nfunc main() {\n\tages := map[string]int{\"cy\": 40, \"ann\": 32}\n\n\ttotal := 0\n\tfor _, v := range ages {\n\t\ttotal += v\n\t}\n\tfmt.Println(total)\n\n\tfor _, k := range slices.Sorted(maps.Keys(ages)) {\n\t\tfmt.Println(k, ages[k])\n\t}\n}\n",
          "output": "72\nann 32\ncy 40",
          "explanation": "The first loop only adds up the values, so its result (72) does not depend on the order. The second loop sorts the keys first, so it always prints ann before cy."
        }
      ],
      "productionNote": "Sort keys before producing anything a human or a test compares: reports, logs, text dumps, and expected values in tests. A loop that is safe in any order, such as summing values, needs no sorting.",
      "commonMistakes": [
        "Writing a test that compares output produced by ranging over a map directly. It passes sometimes and fails other times (a flaky test). Sort the keys first.",
        "Assuming the order is stable because it looked the same twice. It is deliberately unspecified."
      ],
      "sources": [
        {
          "title": "The Go Specification: For statements with range clause",
          "url": "https://go.dev/ref/spec#For_range"
        },
        {
          "title": "maps package: Keys",
          "url": "https://pkg.go.dev/maps#Keys"
        },
        {
          "title": "slices package: Sorted",
          "url": "https://pkg.go.dev/slices#Sorted"
        }
      ]
    },
    {
      "id": "maps-package-and-sets",
      "title": "maps package and sets with map[T]struct{}",
      "explanation": "A map is a reference to shared data. If you write b := a, both variables point at the same map, so changing b also changes a. To get an independent copy use maps.Clone(a).\n\nThe maps package has other helpers. maps.Copy(dst, src) adds all entries of src into dst, overwriting equal keys. maps.Equal(a, b) reports whether two maps have the same keys and values.\n\nA set is a collection of unique items where only membership matters. Go has no separate set type, so you use a map and ignore the values. The usual form is map[string]struct{}. A struct is a type that groups named fields (covered in a later topic), and struct{} is the struct with no fields. It takes no memory, and struct{}{} is its one value. You can also use map[string]bool, which is simpler to read but stores a bool per entry.\n\nTo add an item write seen[\"go\"] = struct{}{}. To test membership use comma-ok: _, ok := seen[\"go\"]. The blank identifier _ throws away the value because only ok matters.",
      "analogy": "A set is a guest list at the door: only the names matter, and nothing is written next to them. You check whether a name is on the list, and writing the same name twice changes nothing. Assigning a map to another variable is like handing someone the same list, not a photocopy; maps.Clone makes the photocopy.",
      "code": [
        {
          "language": "go",
          "filename": "sets.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"maps\"\n)\n\nfunc main() {\n\tseen := map[string]struct{}{}\n\tseen[\"go\"] = struct{}{}\n\tseen[\"go\"] = struct{}{}\n\t_, ok := seen[\"go\"]\n\tfmt.Println(ok, len(seen))\n\n\tages := map[string]int{\"ann\": 31, \"bob\": 25}\n\tc := maps.Clone(ages)\n\tc[\"ann\"] = 1\n\tfmt.Println(ages[\"ann\"], c[\"ann\"])\n\n\talias := ages\n\talias[\"ann\"] = 99\n\tfmt.Println(ages[\"ann\"])\n\n\tfmt.Println(maps.Equal(ages, c))\n\n\tmaps.Copy(c, map[string]int{\"zed\": 7})\n\tfmt.Println(c)\n}\n",
          "output": "true 1\n31 1\n99\nfalse\nmap[ann:1 bob:25 zed:7]",
          "explanation": "Adding \"go\" twice still leaves one entry, so the set has length 1 and membership is true. Changing the clone c leaves ages[\"ann\"] at 31. But alias shares the same map as ages, so setting alias[\"ann\"] = 99 changes ages too. After that, ages (ann 99, bob 25) and c (ann 1, bob 25) differ, so maps.Equal is false. maps.Copy adds \"zed\" to c."
        }
      ],
      "productionNote": "Sets are used to remove duplicate IDs and to track 'already processed' items. If several parts of a program share a map, remember that a change in one place is seen everywhere. Maps are not safe for several goroutines (concurrent tasks, covered in a later topic) to write at once: that causes a fatal error, so such code needs locking.",
      "commonMistakes": [
        "Writing b := a and expecting a copy. Both names refer to the same map; use maps.Clone(a) for an independent copy.",
        "Writing to the same map from several goroutines without protection. Go detects this and stops the program with a fatal error."
      ],
      "sources": [
        {
          "title": "maps package",
          "url": "https://pkg.go.dev/maps"
        },
        {
          "title": "The Go Specification: Struct types",
          "url": "https://go.dev/ref/spec#Struct_types"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What happens when you assign a value to a key in a nil map, such as var m map[string]int followed by m[\"a\"] = 1?",
      "options": [
        "The program panics with 'assignment to entry in nil map'",
        "Go creates the map automatically and stores the value",
        "The assignment is silently ignored",
        "The program does not compile"
      ],
      "answerIndex": 0,
      "explanation": "Reading a nil map is safe, but writing panics because no map storage exists yet. Create the map with make or a literal first."
    },
    {
      "question": "ages[\"zoe\"] returns 0. How can you tell whether \"zoe\" is missing or stored with the value 0?",
      "options": [
        "Compare the result with nil",
        "Use the comma-ok form: v, ok := ages[\"zoe\"] and check ok",
        "Call len(ages[\"zoe\"])",
        "Check whether the result is negative"
      ],
      "answerIndex": 1,
      "explanation": "ok is true only if the key is present. The value alone cannot distinguish a missing key from a stored zero."
    },
    {
      "question": "What does delete(ages, \"nobody\") do when \"nobody\" is not a key in ages?",
      "options": [
        "It panics",
        "It returns an error value",
        "It removes the last entry instead",
        "Nothing; it is safe and has no effect"
      ],
      "answerIndex": 3,
      "explanation": "delete on a missing key is a no-op, so you do not need to check first."
    },
    {
      "question": "Why should you sort the keys before printing a report built from a map?",
      "options": [
        "Because maps cannot be printed without sorting",
        "Because sorting makes the map use less memory",
        "Because range over a map visits entries in an unspecified order that can change between runs",
        "Because range only works on sorted data"
      ],
      "answerIndex": 2,
      "explanation": "Go deliberately varies map iteration order, so output and tests that depend on it would be unstable. slices.Sorted(maps.Keys(m)) gives a stable order."
    },
    {
      "question": "Why is struct{} used as the value type in a set such as map[string]struct{}?",
      "options": [
        "It makes lookups faster than any other type",
        "It is required, because a map cannot hold other value types",
        "It stops other code from changing the map",
        "It carries no data and takes no memory, since only the keys matter"
      ],
      "answerIndex": 3,
      "explanation": "A set only needs to know whether a key is present. struct{} is an empty type with no fields, so it stores nothing extra. map[string]bool also works but stores a bool per entry."
    }
  ]
});
