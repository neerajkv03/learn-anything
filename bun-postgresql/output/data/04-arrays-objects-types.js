window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "04-arrays-objects-types",
  "order": 4,
  "title": "Arrays, Objects & Types",
  "version": "Bun 1.4.5 + PostgreSQL 19.0",
  "summary": "Learn to hold many values in arrays, group named fields in objects, and describe their shape with TypeScript types. You will transform lists with map, filter, find and reduce, model data with type aliases, interfaces and unions, and copy or pick apart objects with spread and destructuring. These are the exact tools you will use later to shape database rows (one record per line of a table, taught in topic 09) into API responses.",
  "prerequisites": ["03-control-flow-functions"],
  "subtopics": [
    {
      "id": "arrays-and-array-methods",
      "title": "Arrays & array methods (map, filter, find)",
      "explanation": "An array is an ordered list of values written between square brackets: `[1200, 450, 3000]`. Each value has a position called its index, and indexes start at 0, not 1. So `prices[0]` is the first value, and `prices[1]` is the second.\n\nThe property `.length` tells you how many values the array holds. In TypeScript the type of an array of numbers is written `number[]`, and an array of objects of a type called `Order` is `Order[]`.\n\nA method is a function that belongs to a value and is called with a dot, like `prices.push(99)`. The method `.push(x)` adds `x` to the end of the array and changes the array itself. The method `.includes(x)` returns `true` if the array contains `x`, otherwise `false`.\n\nThe most useful array methods take a callback (a function you pass in, taught in the previous topic) and call it once per element. They return a new array and leave the original untouched. `map` builds a new array by transforming every element. `filter` builds a new array that keeps only the elements for which your callback returns `true`.\n\n`find` returns the first element for which your callback returns `true`, or `undefined` if none matches, so always handle that case. `some` returns `true` if at least one element matches. `reduce` folds the whole array into one value: you give it a callback `(sum, p) => sum + p` and a starting value (here `0`), and it carries the running result from element to element. In this course we use `reduce` only to add numbers up. Always pass the starting value; without it, an empty array makes `reduce` throw a `TypeError` (an error raised when a value is used in a way its type does not allow).",
      "analogy": "Think of a conveyor belt in a factory carrying boxes. `map` is a worker who paints every box and sends a new painted box down the line. `filter` is an inspector who removes faulty boxes and lets the good ones pass. `find` is someone who grabs the first red box they see, or comes back empty-handed if there is none. `reduce` is the scale at the end that weighs all the boxes into one total. `push` is putting one more box on the end of the belt, and the index is the numbered slot each box sits in, starting at slot 0.",
      "code": [
        {
          "language": "typescript",
          "filename": "arrays-basics.ts",
          "source": "const pricesCents: number[] = [1200, 450, 3000];\n\nconsole.log(pricesCents[0], pricesCents.length);\n\npricesCents.push(99);\nconsole.log(pricesCents);\n\nconsole.log(pricesCents.includes(450));\nconsole.log(pricesCents.includes(7));",
          "output": "1200 3\n[ 1200, 450, 3000, 99 ]\ntrue\nfalse",
          "explanation": "Save this as arrays-basics.ts and run it with `bun run arrays-basics.ts`. Index 0 is the first price and `.length` counts three values. `push` adds 99 to the end of the very same array, which is allowed because `const` only stops you from pointing the name at a different array. `includes` answers true or false."
        },
        {
          "language": "typescript",
          "filename": "arrays.ts",
          "source": "const pricesCents = [1200, 450, 3000];\n\nconsole.log(pricesCents.map((p) => p / 100));\nconsole.log(pricesCents.filter((p) => p >= 1000));\nconsole.log(pricesCents.find((p) => p > 5000));\nconsole.log(pricesCents.some((p) => p > 2000));\nconsole.log(pricesCents.reduce((sum, p) => sum + p, 0));\n\nconst expensive = pricesCents.find((p) => p > 2000);\nif (expensive === undefined) {\n  console.log(\"nothing expensive\");\n} else {\n  console.log(\"first expensive:\", expensive);\n}\n\nconsole.log(pricesCents);",
          "output": "[ 12, 4.5, 30 ]\n[ 1200, 3000 ]\nundefined\ntrue\n4650\nfirst expensive: 3000\n[ 1200, 450, 3000 ]",
          "explanation": "`map` turns cents into dollars, `filter` keeps the prices of at least 1000, and `find` returns `undefined` because nothing is above 5000. `some` is true because 3000 is above 2000. `reduce` starts at 0 and adds each price to get 4650. The `if` handles the possible `undefined` from `find`. The last line shows the original array was never changed by `map`, `filter`, `find`, `some` or `reduce`."
        }
      ],
      "productionNote": "In a backend you constantly turn the array of row objects a database query returns into the array your API sends out (with `map`), drop rows you must not show (with `filter`), and sum order lines into a total in integer cents (with `reduce`). Keeping money as integer cents avoids floating-point rounding surprises.",
      "commonMistakes": [
        "Thinking the first element is at index 1. The first element is at index 0, and the last is at index `length - 1`.",
        "Using the result of `find` as if it always exists. `find` returns `undefined` when nothing matches, so check for that before reading fields from the result.",
        "Calling `reduce` without a starting value. Always write `reduce((sum, p) => sum + p, 0)` so an empty array gives 0 instead of throwing a `TypeError`.",
        "Expecting `map` or `filter` to change the original array. They return a new array; if you ignore the return value, nothing happens."
      ],
      "sources": [
        { "title": "MDN: Array.prototype.map()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map" },
        { "title": "MDN: Array.prototype.filter()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter" },
        { "title": "MDN: Array.prototype.find()", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find" }
      ]
    },
    {
      "id": "objects-and-property-access",
      "title": "Objects & property access",
      "explanation": "An object groups named values called properties: `{ id: 101, status: \"pending\" }`. Each property has a key (its name, like `status`) and a value. Objects can hold other objects, so `order.customer.name` reaches into a nested object. Every row a database query returns will arrive in your program as an object like this.\n\nThere are two ways to read a property. Dot access, `order.status`, is what you use when you know the key while writing the code. Bracket access, `order[\"status\"]`, takes the key as a value, so it also works with a variable: if `const field = \"id\"`, then `order[field]` reads `order.id`. To change a property, assign to it: `order.status = \"paid\"`. Assigning to a key that does not exist yet adds it at runtime, although TypeScript will complain if the object's type does not list that key (the next sub-topic shows how types do that).\n\n`const` stops you from pointing the name `order` at a different object, but it does not freeze the object: its properties can still be changed. Reading a key that does not exist gives `undefined`, not an error.\n\n`Object.keys(obj)` returns an array of the key names, and `Object.entries(obj)` returns an array of `[key, value]` pairs.\n\nProblems start when you read a property of `undefined` itself: `data.customer.name` throws a `TypeError` if `data.customer` is `undefined`. Optional chaining, written `?.`, stops safely: `data.customer?.name` gives `undefined` instead of throwing when `data.customer` is `undefined` or `null`. In the second example, `JSON.parse` (taught in topic 1) returns a value of type `any` (TypeScript does not check it), which is why TypeScript lets us write `data.customer` freely.",
      "analogy": "An object is a filing card with labelled boxes: the label is the key and the text written in the box is the value. Dot access is reading the box whose label you already know, and bracket access is reading the box whose label you just looked up on a sticky note. `const` means the card is glued to the shelf, so you cannot swap it for a different card, but you can still erase and rewrite what is inside the boxes. Optional chaining is checking that a box actually holds a nested card before you try to read inside it.",
      "code": [
        {
          "language": "typescript",
          "filename": "objects.ts",
          "source": "const order = { id: 101, status: \"pending\", customer: { name: \"Asha\" } };\n\norder.status = \"paid\";\nconsole.log(order.status, order.customer.name);\n\nconst field = \"id\";\nconsole.log(order[field]);\n\nconsole.log(Object.keys(order));",
          "output": "paid Asha\n101\n[ \"id\", \"status\", \"customer\" ]",
          "explanation": "The object is declared with `const`, yet `order.status = \"paid\"` works because only the name is constant. Dot access reaches the nested `customer.name`. Bracket access with the variable `field` reads `order.id`. `Object.keys` lists the three key names in the order they were written."
        },
        {
          "language": "typescript",
          "filename": "objects-missing.ts",
          "source": "const data = JSON.parse('{\"id\":102}');\n\nconsole.log(data.customer);\nconsole.log(data.customer?.name);\n// console.log(data.customer.name); // would throw a TypeError\n\nconsole.log(Object.entries({ id: 102, status: \"paid\" }));",
          "output": "undefined\nundefined\n[ [ \"id\", 102 ], [ \"status\", \"paid\" ] ]",
          "explanation": "The parsed object has no `customer` key, so reading it gives `undefined`. Adding `?.` makes the next step stop safely instead of crashing; the commented-out line without `?.` would throw a `TypeError`. `Object.entries` returns an array of `[key, value]` pairs."
        }
      ],
      "productionNote": "Request bodies, database rows and configuration are all objects. Optional chaining is the everyday tool for data that may be incomplete, such as a request body field the client left out.",
      "commonMistakes": [
        "Believing `const` makes an object unchangeable. It only fixes which object the name refers to; the properties can still be reassigned.",
        "Reading a field of something that might be `undefined` (for example `data.customer.name`), which throws a `TypeError`. Use `?.` when the parent may be missing.",
        "Using dot access with a key held in a variable. `order.field` looks for a key literally named `field`; use `order[field]` instead."
      ],
      "sources": [
        { "title": "MDN: Object basics", "url": "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Object_basics" },
        { "title": "MDN: Optional chaining (?.)", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining" }
      ]
    },
    {
      "id": "type-aliases-and-interfaces",
      "title": "Type aliases & interfaces",
      "explanation": "A type describes the shape of a value: which properties it has and what type each one is. A type alias gives a shape a name: `type User = { id: string; email: string; name: string }`. An interface does almost the same for object shapes: `interface Product { id: string; name: string; priceCents: number }`. You then annotate a variable with the name, like `const u: User = {...}`, and an array of them is `User[]`.\n\nTypeScript uses structural typing: a value fits a type if it has the required properties with the right types, no matter where it came from. When you write an object literal directly where a type is expected, TypeScript also flags extra properties that the type does not list, which catches typos.\n\nAn interface can be extended with `extends`, which creates a new shape that has all the properties of the old one plus more. Type aliases can also describe unions (the next sub-topic), so this course uses `type` for data shapes by default and uses `interface` only when it is helpful to extend. Pick one style and stay consistent.\n\nTypes are erased: Bun strips them before running the file and does not check them. Your editor, or the TypeScript checker, shows the errors; the program itself runs as if the annotations were not there. Types therefore never exist at runtime and cannot validate data arriving from outside.\n\nIds are typed `string` here because PostgreSQL (the database program this course uses) sends `bigint` values (large whole-number database columns) to your program as strings (you will see why in a later topic).",
      "analogy": "A type is a cookie cutter. Any piece of dough that matches the outline passes, whichever bakery made it, which is structural typing. A dough piece missing a required part, such as the price, does not fit the cutter, and the editor marks it. An interface that extends another is a bigger cutter that contains the smaller cutter's outline plus extra decoration.",
      "code": [
        {
          "language": "typescript",
          "filename": "types.ts",
          "source": "type User = { id: string; email: string; name: string };\n\ninterface Product {\n  id: string;\n  name: string;\n  priceCents: number;\n}\n\ninterface DiscountedProduct extends Product {\n  discountCents: number;\n}\n\nconst u: User = { id: \"1\", email: \"asha@example.com\", name: \"Asha\" };\nconst p: Product = { id: \"7\", name: \"Notebook\", priceCents: 2499 };\nconst d: DiscountedProduct = { id: \"8\", name: \"Pen\", priceCents: 300, discountCents: 50 };\n\nconsole.log(`${u.name} bought ${p.name}`);\nconsole.log(`${d.name} saves ${d.discountCents}`);\n\n// const bad: Product = { id: \"8\", name: \"Pen\" };\n// Editor error: Property 'priceCents' is missing in type ...",
          "output": "Asha bought Notebook\nPen saves 50",
          "explanation": "`User` is a type alias and `Product` is an interface. `DiscountedProduct` extends `Product`, so it needs all four properties. The commented-out `bad` line would be flagged by the editor because `priceCents` is missing; Bun itself would still run the file, since it does not check types."
        }
      ],
      "productionNote": "You will define a type for every database row and every request or response body (topic 18 builds these into a layered design). Good types make the editor catch wrong field names before you ever run the server.",
      "commonMistakes": [
        "Thinking types exist at runtime. They are erased before the program runs, so a type cannot check what a client actually sends.",
        "Mixing `type` and `interface` for the same kind of data without a reason. Choose one convention (here, `type`) and use `interface` deliberately, for example when extending.",
        "Typing database ids as `number`. PostgreSQL `bigint` arrives as a `string`, so type ids as `string`."
      ],
      "sources": [
        { "title": "TypeScript Handbook: Object Types", "url": "https://www.typescriptlang.org/docs/handbook/2/objects.html" },
        { "title": "TypeScript Handbook: Everyday Types (type aliases and interfaces)", "url": "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces" }
      ]
    },
    {
      "id": "optional-properties-and-unions",
      "title": "Optional properties & union types",
      "explanation": "An optional property is marked with `?`: `couponCode?: string` means the property may be missing, so its value has type `string | undefined`. A function parameter can be optional the same way.\n\nA union type `A | B` means a value is one of those types. A literal union lists exact allowed values: `type OrderStatus = \"pending\" | \"paid\" | \"shipped\" | \"cancelled\"` allows only those four strings, and TypeScript rejects any other, such as `\"refunded\"`. This mirrors a database CHECK constraint (a rule that limits a column's allowed values, covered in topic 11). A nullable column (a database column that may be empty) is typed with a union such as `Date | null`; a `Date` is JavaScript's date-and-time object.\n\nNarrowing is how you use a union safely. Inside a check, TypeScript knows the more specific type. `typeof x === \"string\"` narrows to `string`, `x === null` narrows out `null`, and `\"radius\" in obj` (the `in` operator checks whether an object has a key) narrows to the union member that has that key.\n\nIn the example, `toISOString()` turns a `Date` into text like `2026-11-20T10:00:00.000Z`, and `.slice(0, 10)` keeps the characters from position 0 up to (not including) position 10, which is the date part.",
      "analogy": "A literal union is a drop-down list on an order form: you can only choose a listed status, and cannot type a dish that is not on the menu. An optional property is the form field labelled \"add a note (optional)\": it may be left blank. Narrowing is the clerk checking the form: once they see the note field is filled in, they can safely read it.",
      "code": [
        {
          "language": "typescript",
          "filename": "unions.ts",
          "source": "type OrderStatus = \"pending\" | \"paid\" | \"shipped\" | \"cancelled\";\n\ntype Order = {\n  id: string;\n  status: OrderStatus;\n  couponCode?: string;\n  shippedAt: Date | null;\n};\n\nfunction label(o: Order): string {\n  if (o.shippedAt === null) return `${o.status} (not shipped)`;\n  return `${o.status} on ${o.shippedAt.toISOString().slice(0, 10)}`;\n}\n\nconsole.log(label({ id: \"1\", status: \"paid\", shippedAt: null }));\nconsole.log(label({ id: \"2\", status: \"shipped\", shippedAt: new Date(\"2026-11-20T10:00:00Z\") }));\n\n// label({ id: \"3\", status: \"refunded\", shippedAt: null });\n// Editor error: \"refunded\" is not assignable to type OrderStatus\n\nfunction couponText(code?: string): string {\n  if (typeof code === \"string\") return `coupon ${code}`;\n  return \"no coupon\";\n}\n\nconsole.log(couponText(\"SAVE10\"));\nconsole.log(couponText());\n\ntype Payment = { cardLast4: string } | { bankRef: string };\n\nfunction payLabel(p: Payment): string {\n  if (\"cardLast4\" in p) return `card ending ${p.cardLast4}`;\n  return `bank ${p.bankRef}`;\n}\n\nconsole.log(payLabel({ cardLast4: \"4242\" }));\nconsole.log(payLabel({ bankRef: \"ref-77\" }));",
          "output": "paid (not shipped)\nshipped on 2026-11-20\ncoupon SAVE10\nno coupon\ncard ending 4242\nbank ref-77",
          "explanation": "`label` first checks for `null`; after that check, TypeScript knows `shippedAt` is a `Date`, so `toISOString()` is allowed. The commented call would be rejected because \"refunded\" is not in `OrderStatus`. `couponText` narrows an optional parameter with `typeof`, and `payLabel` narrows a union of two shapes with `in`."
        }
      ],
      "productionNote": "Status columns become literal unions, nullable columns become `X | null`, and PATCH request bodies (partial updates) use optional properties because the client sends only the fields it wants to change.",
      "commonMistakes": [
        "Typing a status as plain `string` when a literal union would catch typos like \"payed\".",
        "Forgetting the `null` or `undefined` branch, so the code crashes with a `TypeError` when a nullable value is empty.",
        "Assuming a union's members all have the same properties. Narrow first, then use the properties of the narrowed type."
      ],
      "sources": [
        { "title": "TypeScript Handbook: Union Types", "url": "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types" },
        { "title": "TypeScript Handbook: Narrowing", "url": "https://www.typescriptlang.org/docs/handbook/2/narrowing.html" }
      ]
    },
    {
      "id": "destructuring-and-spread",
      "title": "Destructuring & spread",
      "explanation": "Destructuring pulls values out of an object or array into separate variables. For an object: `const { id, status } = order;` creates `id` and `status` from the properties with those names. You can rename with a colon, `{ id: orderId }`, and give a default used when the value is `undefined`, `{ limit = 20 }`. For an array, you use square brackets and positions: `const [first] = rows;` takes the first element, which is handy when a query returns a list holding one row.\n\nSpread, written `...`, copies the properties of an object or the elements of an array into a new one. `{ ...order, status: \"paid\" }` makes a new object with all of `order`'s properties, with `status` replaced. `[...nums, 4]` makes a new array with a value added. The copy is shallow: only the top level is copied, so nested objects and arrays are still shared with the original.\n\nThe same three dots in a destructuring pattern are called rest: `const { passwordHash, ...safeUser } = user;` puts every property except `passwordHash` into `safeUser`. This is the standard way to strip a secret field.\n\nDestructuring from `undefined` or `null` throws a `TypeError`, so make sure the value exists first; with an array, `first?.id` (optional chaining) is safe if the array was empty.",
      "analogy": "Think of unpacking a delivery box. Destructuring is taking out only the items you need and putting each on its own shelf. Spread is photocopying a form and then changing one box on the copy, leaving the original form as it was; but if the form has a staple-on attachment, the copy points to the same attachment, which is why the copy is shallow. Rest is everything left in the box after you remove the secret letter.",
      "code": [
        {
          "language": "typescript",
          "filename": "destructure.ts",
          "source": "const user = { id: \"1\", email: \"asha@example.com\", passwordHash: \"$argon2id$...\" };\nconst { passwordHash, ...safeUser } = user;\nconsole.log(safeUser);\n\nconst order = { id: \"101\", status: \"pending\" };\nconst options: { limit?: number } = {};\nconst { id: orderId, status } = order;\nconst { limit = 20 } = options;\nconsole.log(orderId, status, limit);\n\nconst rows = [{ id: \"101\" }];\nconst [first] = rows;\nconsole.log(first?.id);\n\nconst updated = { ...order, status: \"paid\" };\nconsole.log(updated.status, order.status);\n\nconst nums = [1, 2, 3];\nconsole.log([...nums, 4]);\n\nconst original = { id: \"101\", tags: [\"gift\"] };\nconst copy = { ...original, id: \"102\" };\ncopy.tags.push(\"rush\");\nconsole.log(original.tags);",
          "output": "{ id: \"1\", email: \"asha@example.com\" }\n101 pending 20\n101\npaid pending\n[ 1, 2, 3, 4 ]\n[ \"gift\", \"rush\" ]",
          "explanation": "Rest removes `passwordHash` from the object that would be sent out. The rename `id: orderId` creates a variable called `orderId`, and `limit = 20` supplies the default because `options` has no limit. `first?.id` reads the first row safely. Spreading `order` with `status: \"paid\"` gives a changed copy while the original stays `pending`. The last lines show the shallow copy: `copy.tags` is the same array as `original.tags`, so pushing to one changes both."
        }
      ],
      "productionNote": "Before returning a user from your API you must remove `passwordHash`, and rest destructuring does it in one line. Reading the first row of a query result with `const [row] = rows` is just as common; remember it can be `undefined` when no row matched.",
      "commonMistakes": [
        "Thinking spread makes a deep copy. Nested objects and arrays are shared between the copy and the original; changing one changes both.",
        "Destructuring a value that may be `undefined`, which throws a `TypeError`. Check first, or use `?.`.",
        "Putting the rest element anywhere but last. `...safeUser` must be the final item in the pattern."
      ],
      "sources": [
        { "title": "MDN: Destructuring", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring" },
        { "title": "MDN: Spread syntax (...)", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax" }
      ]
    }
  ],
  "quiz": [
    {
      "question": "What does `[5, 10, 15].filter(n => n > 5).map(n => n * 2)` produce?",
      "options": ["[10, 20, 30]", "[10, 15]", "[20, 30]", "[5, 20, 30]"],
      "answerIndex": 2,
      "explanation": "`filter` keeps 10 and 15 (the values above 5), then `map` doubles each of them, giving [20, 30]."
    },
    {
      "question": "`const order = { status: \"pending\" };` Can you then run `order.status = \"paid\"`, and why?",
      "options": [
        "Yes, because `const` only fixes which object the name refers to, not the object's properties",
        "No, because `const` makes the whole object unchangeable",
        "No, because strings can never be reassigned",
        "Yes, but only if you first convert the object to an array"
      ],
      "answerIndex": 0,
      "explanation": "`const` prevents reassigning the variable itself (`order = somethingElse`), but the properties inside the object can still be changed."
    },
    {
      "question": "Given `type OrderStatus = \"pending\" | \"paid\" | \"shipped\" | \"cancelled\"`, which value is allowed for a variable of that type?",
      "options": [
        "\"refunded\"",
        "\"Paid\"",
        "42",
        "\"shipped\""
      ],
      "answerIndex": 3,
      "explanation": "A literal union allows only the exact listed strings. \"refunded\" and \"Paid\" are not listed, and a number is a different type."
    },
    {
      "question": "How do you remove `passwordHash` from a `user` object while keeping its other properties in a new object?",
      "options": [
        "const safeUser = user.passwordHash",
        "const { passwordHash, ...safeUser } = user;",
        "const [passwordHash, safeUser] = user;",
        "const safeUser = { user, passwordHash: null };"
      ],
      "answerIndex": 1,
      "explanation": "Rest destructuring takes `passwordHash` out and collects every other property into `safeUser`."
    },
    {
      "question": "What does `find` return when no element matches the callback?",
      "options": [
        "An empty array",
        "`null`",
        "`undefined`",
        "It throws a `TypeError`"
      ],
      "answerIndex": 2,
      "explanation": "`find` returns `undefined` when nothing matches, so code must handle that case before using the result."
    }
  ]
});
