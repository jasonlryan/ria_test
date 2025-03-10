// Parse the response to remove the citations.
const parseResponse = (content) => {
  return content.replace(/\【.*?\】/g, "");
};

export { parseResponse };
