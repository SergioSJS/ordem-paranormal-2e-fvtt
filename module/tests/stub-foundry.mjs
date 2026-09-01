/**
 * Stubs mínimos da API do Foundry.
 *
 * Servem só para os testes de carga: garantem que todo módulo do sistema *importa* sem
 * erro — classes base resolvidas, nada referenciando um símbolo que não existe. Não
 * simulam comportamento; o teste de comportamento vive nos módulos puros.
 */

class DataField {
  constructor(opcoes = {}) { this.options = opcoes; }
}
const campo = () => class extends DataField {};

class TypeDataModel {
  static defineSchema() { return {}; }
  static migrateData(fonte) { return fonte; }
}

class ApplicationV2 {
  static DEFAULT_OPTIONS = {};
  static PARTS = {};
  constructor(opcoes = {}) { this.options = opcoes; }
  render() { return this; }
  _onClose() {}
  _onRender() {}
  async _prepareContext() { return {}; }
  _configureRenderParts() { return {}; }
}

const HandlebarsApplicationMixin = (Base) => class extends Base {};

/**
 * Base das fichas. Precisa ser uma classe de verdade — campos privados (`#metodo`)
 * só existem em instâncias construídas pela cadeia real de construtores.
 */
class DocumentSheetV2 extends ApplicationV2 {
  constructor(opcoes = {}) {
    super(opcoes);
    this.document = opcoes.document ?? null;
  }
  get actor() { return this.document; }
  get item() { return this.document; }
  get isEditable() { return this.options.editable ?? true; }
  get element() { return { querySelectorAll: () => [] }; }
}

class RollStub {
  constructor(formula, dados = {}, opcoes = {}) {
    this.formula = formula;
    this.data = dados;
    this.options = opcoes;
    this.dice = [];
    this._evaluated = false;
  }
  async evaluate() { this._evaluated = true; return this; }
}

export function instalarStubs() {
  globalThis.foundry = {
    abstract: { TypeDataModel },
    data: {
      fields: {
        SchemaField: campo(), StringField: campo(), NumberField: campo(),
        BooleanField: campo(), HTMLField: campo(), SetField: campo(),
        ObjectField: campo(), TypedObjectField: campo(), DocumentUUIDField: campo(),
      },
    },
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin, DialogV2: class {} },
      sheets: { ActorSheetV2: DocumentSheetV2, ItemSheetV2: DocumentSheetV2 },
      handlebars: { renderTemplate: async () => "", loadTemplates: async () => [] },
      ux: { TextEditor: { implementation: { enrichHTML: async (s) => s } } },
    },
    documents: { collections: { Actors: { registerSheet() {}, unregisterSheet() {} }, Items: { registerSheet() {}, unregisterSheet() {} } } },
    appv1: { sheets: { ActorSheet: class {}, ItemSheet: class {} } },
    utils: {
      escapeHTML: (s) => String(s),
      getProperty: (obj, caminho) => caminho.split(".").reduce((o, k) => o?.[k], obj),
      deepClone: (v) => structuredClone(v),
    },
  };

  globalThis.Roll = RollStub;
  globalThis.Actor = class { static updateDocuments() {} };
  globalThis.Item = class {};
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Handlebars = { registerHelper() {}, SafeString: class { constructor(s) { this.s = s; } } };
  globalThis.Hooks = { on() {}, once() {} };
  globalThis.CONFIG = { Actor: { dataModels: {} }, Item: { dataModels: {} }, Dice: { rolls: [] }, Combat: {} };
  globalThis.CONST = {};
  globalThis.game = {
    i18n: { localize: (k) => k, format: (k) => k },
    settings: { register() {}, get: () => 7 },
    user: { isGM: true },
    actors: { get: () => null },
  };
  globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
  globalThis.canvas = { tokens: { controlled: [] }, scene: null };
  globalThis.TextEditor = { enrichHTML: async (s) => s };
}
