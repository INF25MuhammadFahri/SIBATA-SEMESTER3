import readline from "node:readline";

/**
 * Interactive non-blocking CLI command manager.
 */
class CommandManager {
  /**
   * Creates a CLI instance and starts listening to stdin.
   */
  constructor() {
    /** @type {Map<string, {handler: Function, description: string}>} */
    this.commands = new Map();

    /** @type {readline.Interface} */
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt:"\n>"
    });
    this.rl.on("SIGINT", () => {
      process.emit("SIGINT");
    });
    //console.log(">");
    //process.stdout.write("\n>")
    this.rl.on("line", (input) => {
      this.execute(input);
      //process.stdout.write("\n>")
    });
  }

  /**
   * Registers a new command.
   *
   * @param {string} name - Command name.
   * @param {(...args: string[]) => void | Promise<void>} handler - Command handler.
   * @param {string} [description=""] - Command description.
   * @returns {void}
   * @throws {Error} If the command name is already registered.
   */
  register(name, handler, description = "") {
    if (this.commands.has(name)) {
      throw new Error(`Command '${name}' sudah terdaftar`);
    }

    this.commands.set(name, {
      handler,
      description,
    });
  }

  /**
   * Executes a command from raw terminal input.
   *
   * @param {string} input - Raw input string.
   * @returns {Promise<void>}
   */
  async execute(input) {
    const [name, ...args] = input.trim().split(/\s+/);

    if (!name) return;

    const command = this.commands.get(name);
    
    if (!command) {
      console.log(`Command '${name}' tidak ditemukan`);
      return;
    }

    try {
      await command.handler(...args);
    } catch (err) {
      console.error("Command error:", err);
    }
  }

  /**
   * Closes the readline interface.
   *
   * Stops accepting further terminal input.
   *
   * @returns {void}
   */
  close() {
    this.rl.close();
  }
}

export default CommandManager;
