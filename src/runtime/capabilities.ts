import { CapabilityRuntime } from "worthdoing-capabilities";

export class CapabilityBridge {
  private runtime: CapabilityRuntime;

  constructor(apiKeys: Record<string, string>) {
    this.runtime = new CapabilityRuntime({ apiKeys });
  }

  async execute(name: string, input: Record<string, unknown>): Promise<unknown> {
    // Map capability names to runtime client methods
    const [provider, method] = name.includes(".") ? name.split(".", 2) : [name, ""];

    switch (provider) {
      // Exa
      case "exa":
        if (method === "search") return await this.runtime.exa.search(input as any);
        if (method === "findSimilar" || method === "find_similar") return await this.runtime.exa.findSimilar(input.url as string);
        if (method === "contents") return await this.runtime.exa.contents(input.urls as string[]);
        if (method === "answer") return await this.runtime.exa.answer(input.query as string);
        break;

      // Tavily
      case "tavily":
        if (method === "search") return await this.runtime.tavily.search(input as any);
        if (method === "extract") return await this.runtime.tavily.extract(input.urls as string[]);
        break;

      // Firecrawl
      case "firecrawl":
        if (method === "scrape") return await this.runtime.firecrawl.scrape(input.url as string, input as any);
        if (method === "search") return await this.runtime.firecrawl.search(input.query as string, input as any);
        if (method === "map") return await this.runtime.firecrawl.map(input.url as string);
        break;

      // OpenRouter
      case "openrouter":
        if (method === "chat") return await this.runtime.openrouter.chat(input as any);
        if (method === "models") return await this.runtime.openrouter.models();
        break;

      // OpenAlex
      case "openalex":
        if (method === "works") return await this.runtime.openalex.works(input as any);
        if (method === "authors") return await this.runtime.openalex.authors(input as any);
        if (method === "institutions") return await this.runtime.openalex.institutions(input as any);
        break;

      // FMP
      case "fmp":
        if (method === "quote") return await this.runtime.fmp.quote(input.symbol as string);
        if (method === "profile") return await this.runtime.fmp.profile(input.symbol as string);
        if (method === "financialStatements") return await this.runtime.fmp.financialStatements(input.symbol as string, input as any);
        if (method === "historicalPrices") return await this.runtime.fmp.historicalPrices(input.symbol as string, input as any);
        break;

      // EODHD
      case "eodhd":
        if (method === "eod") return await this.runtime.eodhd.eod(input.symbol as string, input as any);
        if (method === "fundamentals") return await this.runtime.eodhd.fundamentals(input.symbol as string);
        if (method === "search") return await this.runtime.eodhd.search(input.query as string);
        break;
    }

    throw new Error(`Unknown capability: ${name}. Use /caps to list available capabilities.`);
  }

  list(): string[] {
    return this.runtime.listCapabilities();
  }
}
