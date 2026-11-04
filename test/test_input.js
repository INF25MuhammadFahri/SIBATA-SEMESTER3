import readline from "node:readline";

console.log("Before:", process.stdin.isRaw);

const cli = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});
const cli2 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

console.log("After:", process.stdin.isRaw);

cli.on("line", (input) => {
    console.log("Received:", JSON.stringify(input));
});
cli.on("line", (input) => {
    console.log({
        input,
        length: input.length,
        chars: [...input]
    });
});