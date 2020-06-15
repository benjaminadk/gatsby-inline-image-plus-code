/** @jsx jsx */
import { jsx } from 'theme-ui';
import getByPath from 'lodash/get';
import { Link } from 'gatsby';
import Img from 'gatsby-image';
import parser, { domToReact } from 'html-react-parser';
import { Styled } from 'theme-ui';
import URIParser from 'urijs';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { xonokai } from 'react-syntax-highlighter/dist/esm/styles/prism';
import jsxLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';

SyntaxHighlighter.registerLanguage('jsx', jsxLanguage);
SyntaxHighlighter.registerLanguage('javascript', javascript);

let myStyle = { ...xonokai };
myStyle['code[class*="language-"]']['fontFamily'] = 'Roboto Mono';
myStyle['code[class*="language-"]']['fontSize'] = '.9rem';
myStyle['pre[class*="language-"]']['background'] = '#333333';
myStyle['comment']['color'] = '#fafafa';

/**
 * swaps external URLs in <a> and <img> elements if they were downloaded and are available locally
 * returns React elements
 * @param  {string} content             post content
 * @param  {string} wordPressUrl        wordpress uploads url
 * @param  {string} uploadsUrl          wordpress site url
 * @return {React}                      React elements
 *
 * contentParser(content, pluginOptions)
 */
export default function contentParser(
  { content },
  { wordPressUrl, uploadsUrl }
) {
  if (typeof content === 'undefined') {
    console.log(
      'ERROR: contentParser requires content parameter to be string but got undefined.'
    );
  }

  if (typeof content !== 'string') {
    return content;
  }

  const subdirectoryCorrection = (path, wordPressUrl) => {
    const wordPressUrlParsed = new URIParser(wordPressUrl);
    // detect if WordPress is installed in subdirectory
    const subdir = wordPressUrlParsed.path();
    return path.replace(subdir, '/');
  };

  const getLanguage = (node) => {
    if (node.attribs.class != null) {
      return node.attribs.class;
    }
    return null;
  };

  const getCode = (node) => {
    if (node.children.length > 0 && node.children[0].name === 'code') {
      return node.children[0].children;
    } else {
      return node.children;
    }
  };

  const parserOptions = {
    replace: (domNode) => {
      if (domNode.name === 'pre') {
        return (
          node.children.length > 0 && (
            <SyntaxHighlighter style={myStyle} language={getLanguage(node)}>
              {domToReact(getCode(node))}
            </SyntaxHighlighter>
          )

          // <Code language={getLanguage(node)}>{domToReact(getCode(node))}</Code>
        );
      }

      let elementUrl =
        (domNode.name === 'a' && domNode.attribs.href) ||
        (domNode.name === 'img' && domNode.attribs.src) ||
        null;

      if (!elementUrl) {
        return;
      }

      let urlParsed = new URIParser(elementUrl);

      // TODO test if this hash handling is sufficient
      if (elementUrl === urlParsed.hash()) {
        return;
      }

      // handling relative url
      const isUrlRelative = urlParsed.is('relative');

      if (isUrlRelative) {
        urlParsed = urlParsed.absoluteTo(wordPressUrl);
        elementUrl = urlParsed.href();
      }

      // removes protocol to handle mixed content in a page
      let elementUrlNoProtocol = elementUrl.replace(/^https?:/i, '');
      let uploadsUrlNoProtocol = uploadsUrl.replace(/^https?:/i, '');
      let wordPressUrlNoProtocol = wordPressUrl.replace(/^https?:/i, '');

      let className = getByPath(domNode, 'attribs.class', '');
      // links to local files have this attribute set in sourceParser
      let wasLinkProcessed = getByPath(
        domNode,
        'attribs[data-gts-swapped-href]',
        null
      );

      // replaces local links with <Link> element
      if (
        domNode.name === 'a' &&
        !wasLinkProcessed &&
        elementUrlNoProtocol.includes(wordPressUrlNoProtocol) &&
        !elementUrlNoProtocol.includes(uploadsUrlNoProtocol)
      ) {
        let url = urlParsed.path();
        url = subdirectoryCorrection(url, wordPressUrl);
        return (
          <Styled.a as={Link} to={url} className={className}>
            {domToReact(domNode.children, parserOptions)}
          </Styled.a>
        );
      }

      // cleans up internal processing attribute
      if (wasLinkProcessed) {
        delete domNode.attribs['data-gts-swapped-href'];
      }

      // data passed from sourceParser
      const fluidData =
        domNode.name === 'img' &&
        getByPath(domNode, 'attribs[data-gts-encfluid]', null);

      if (fluidData) {
        const fluidDataParsed = JSON.parse(fluidData);

        let altText = getByPath(domNode, 'attribs.alt', '');
        let imageTitle = getByPath(domNode, 'attribs.title', null);

        if (imageTitle && !altText) {
          altText = imageTitle;
        }

        // respects original "width" attribute
        // sets width accordingly
        let extraSx = {};
        if (
          domNode.attribs.width &&
          !Number.isNaN(Number.parseInt(domNode.attribs.width, 10))
        ) {
          extraSx.width = `${domNode.attribs.width}px`;
        }

        return (
          <Img
            sx={{
              variant: 'styles.SourcedImage',
              ...extraSx,
            }}
            fluid={fluidDataParsed}
            className={className}
            alt={altText}
            title={imageTitle}
          />
        );
      }
    },
  };

  return parser(content, parserOptions);
}
