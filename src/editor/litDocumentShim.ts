type MinimalDocument = Pick<Document, "createComment" | "createElement" | "createTextNode" | "createTreeWalker">;

const globalDocument = globalThis as typeof globalThis & { document?: Document };
let shimDocumentRef: MinimalDocument | null = null;

if (globalDocument.document === undefined) {
  const shimDocument: MinimalDocument = {
    createComment(data = "") {
      return getActiveDocument().createComment(data);
    },
    createElement(tagName: string) {
      return getActiveDocument().createElement(tagName);
    },
    createTextNode(data: string) {
      return getActiveDocument().createTextNode(data);
    },
    createTreeWalker(root: Node, whatToShow?: number) {
      const activeDocument = tryGetActiveDocument();
      if (!activeDocument) {
        return {
          currentNode: root,
          nextNode() {
            return null;
          },
        } as TreeWalker;
      }

      return activeDocument.createTreeWalker(root === (shimDocument as unknown as Node) ? activeDocument : root, whatToShow);
    },
  };

  Object.defineProperty(globalDocument, "document", {
    configurable: true,
    value: shimDocument,
    writable: true,
  });
  shimDocumentRef = shimDocument;
}

function tryGetActiveDocument(): Document | null {
  const currentDocument = globalDocument.document;
  if (currentDocument && currentDocument !== shimDocumentRef) {
    return currentDocument;
  }

  const windowDocument = globalThis.window?.document;
  return windowDocument ?? null;
}

function getActiveDocument(): Document {
  const activeDocument = tryGetActiveDocument();
  if (!activeDocument) {
    throw new Error("Document is not available. Mount the editor in a browser-like environment.");
  }

  return activeDocument;
}
