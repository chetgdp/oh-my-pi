import {
  AbstractMermaidTokenBuilder,
  AbstractMermaidValueConverter,
  EmptyFileSystem,
  MermaidGeneratedSharedModule,
  TreemapGrammarGeneratedModule,
  __name,
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  inject
} from "./main.7nqvneh8.js";

// ../../node_modules/@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-6K3QC6MW.mjs
var TreemapTokenBuilder = class extends AbstractMermaidTokenBuilder {
  static {
    __name(this, "TreemapTokenBuilder");
  }
  constructor() {
    super(["treemap"]);
  }
};
var classDefRegex = /classDef\s+([A-Z_a-z]\w+)(?:\s+([^\n\r;]*))?;?/;
var TreemapValueConverter = class extends AbstractMermaidValueConverter {
  static {
    __name(this, "TreemapValueConverter");
  }
  runCustomConverter(rule, input, _cstNode) {
    if (rule.name === "NUMBER2") {
      return parseFloat(input.replace(/,/g, ""));
    } else if (rule.name === "SEPARATOR") {
      return input.substring(1, input.length - 1);
    } else if (rule.name === "STRING2") {
      return input.substring(1, input.length - 1);
    } else if (rule.name === "INDENTATION") {
      return input.length;
    } else if (rule.name === "ClassDef") {
      if (typeof input !== "string") {
        return input;
      }
      const match = classDefRegex.exec(input);
      if (match) {
        return {
          $type: "ClassDefStatement",
          className: match[1],
          styleText: match[2] || undefined
        };
      }
    }
    return;
  }
};
function registerValidationChecks(services) {
  const validator = services.validation.TreemapValidator;
  const registry = services.validation.ValidationRegistry;
  if (registry) {
    const checks = {
      Treemap: validator.checkSingleRoot.bind(validator)
    };
    registry.register(checks, validator);
  }
}
__name(registerValidationChecks, "registerValidationChecks");
var TreemapValidator = class {
  static {
    __name(this, "TreemapValidator");
  }
  checkSingleRoot(doc, accept) {
    let rootNodeIndentation;
    for (const row of doc.TreemapRows) {
      if (!row.item) {
        continue;
      }
      if (rootNodeIndentation === undefined && row.indent === undefined) {
        rootNodeIndentation = 0;
      } else if (row.indent === undefined) {
        accept("error", "Multiple root nodes are not allowed in a treemap.", {
          node: row,
          property: "item"
        });
      } else if (rootNodeIndentation !== undefined && rootNodeIndentation >= parseInt(row.indent, 10)) {
        accept("error", "Multiple root nodes are not allowed in a treemap.", {
          node: row,
          property: "item"
        });
      }
    }
  }
};
var TreemapModule = {
  parser: {
    TokenBuilder: /* @__PURE__ */ __name(() => new TreemapTokenBuilder, "TokenBuilder"),
    ValueConverter: /* @__PURE__ */ __name(() => new TreemapValueConverter, "ValueConverter")
  },
  validation: {
    TreemapValidator: /* @__PURE__ */ __name(() => new TreemapValidator, "TreemapValidator")
  }
};
function createTreemapServices(context = EmptyFileSystem) {
  const shared = inject(createDefaultSharedCoreModule(context), MermaidGeneratedSharedModule);
  const Treemap = inject(createDefaultCoreModule({ shared }), TreemapGrammarGeneratedModule, TreemapModule);
  shared.ServiceRegistry.register(Treemap);
  registerValidationChecks(Treemap);
  return { shared, Treemap };
}
__name(createTreemapServices, "createTreemapServices");

export { TreemapModule, createTreemapServices };

//# debugId=6C6FF7175A63960D64756E2164756E21
