export interface QueryExample {
  label: string;
  query: string;
  description?: string;
}

export interface QueryExampleGroup {
  name: string;
  examples: QueryExample[];
}

/** Example queries written against the built-in sample dataset. */
export const QUERY_EXAMPLES: QueryExampleGroup[] = [
  {
    name: "Basics",
    examples: [
      { label: "Identity", query: ".", description: "The whole document" },
      { label: "Top-level field", query: ".name" },
      { label: "Nested field", query: ".user.email" },
      { label: "Array element", query: ".items[0]" },
      { label: "Last element", query: ".items[-1]" },
      { label: "Slice", query: ".items[1:3]", description: "Elements 1 and 2" },
      { label: "Iterate", query: ".items[]", description: "Stream of every element" },
      { label: "Optional field", query: ".items[] | .discount // \"none\"", description: "Alternative operator for null" },
    ],
  },
  {
    name: "Arrays",
    examples: [
      { label: "Length", query: ".items | length" },
      { label: "Pluck names", query: ".users[] | .name" },
      { label: "Map", query: ".items | map(.price)" },
      { label: "Sum", query: ".items | map(.price) | add" },
      { label: "Sort", query: ".items | map(.price) | sort" },
      { label: "Sort by field", query: ".users | sort_by(.age)" },
      { label: "Unique", query: ".items | map(.category) | unique" },
      { label: "Reverse", query: ".items | reverse" },
      { label: "Group by", query: ".items | group_by(.category)" },
      { label: "Min / max / avg", query: ".items | map(.price) | {min: min, max: max, avg: (add / length)}" },
    ],
  },
  {
    name: "Filtering",
    examples: [
      { label: "Select by number", query: ".users[] | select(.age > 25)" },
      { label: "Select active", query: ".users[] | select(.active == true)" },
      { label: "Boolean logic", query: ".items[] | select(.price > 50 and .stock > 0) | .name" },
      { label: "Not / or", query: ".users[] | select((.active | not) or .age >= 40) | .name" },
      { label: "Contains", query: ".users[] | select(.roles | index(\"admin\")) | .email" },
      { label: "Regex match", query: ".items[] | select(.name | test(\"key\"; \"i\"))" },
    ],
  },
  {
    name: "Objects",
    examples: [
      { label: "Keys", query: ".items[0] | keys" },
      { label: "Values", query: ".items[0] | [.[]]" },
      { label: "Entries", query: ".user | to_entries" },
      { label: "Construct", query: ".items | map({name: .name, price: .price})" },
      { label: "Dynamic keys", query: ".users | map({(.name): .age}) | add" },
      { label: "Delete field", query: "del(.users, .items)" },
      { label: "Update in place", query: ".items |= map(select(.stock > 0))" },
    ],
  },
  {
    name: "Advanced",
    examples: [
      {
        label: "Group summary",
        query: ".items | group_by(.category) | map({category: .[0].category, count: length, total: (map(.price) | add)})",
      },
      { label: "String interpolation", query: ".users[] | \"\\(.name) <\\(.email)>\"" },
      { label: "Recursive numbers", query: "[.. | numbers] | length" },
      { label: "All paths", query: "[paths(type == \"number\")] | map(join(\".\"))", description: "Paths of every number" },
      { label: "Reduce", query: "reduce .items[] as $i (0; . + $i.price * $i.stock)" },
      { label: "Variables", query: ".items as $all | $all | map(select(.price > ($all | map(.price) | add / length))) | map(.name)" },
      { label: "Multiple outputs", query: ".name, (.users | length), .meta.version" },
    ],
  },
];
