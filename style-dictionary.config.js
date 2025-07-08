// style-dictionary.config.js

// --- 1. Style Dictionary 핵심 모듈 불러오기 ---
// 공식 문서에서 제시된 가장 표준적인 방식입니다.
const StyleDictionary = require('style-dictionary');

// --- 2. 커스텀 포맷터의 모든 헬퍼 함수와 포맷터 로직을 이 파일 안에 정의 ---

// 폰트 굵기 문자열을 UIFont.Weight에 매핑하는 헬퍼 함수
function getUIFontWeight(fontWeight) {
  switch (fontWeight.toLowerCase()) {
    case 'bold': return '.bold';
    case 'semibold': return '.semibold';
    case 'medium': return '.medium';
    case 'regular': return '.regular';
    default: return '.regular';
  }
}

// 폰트 패밀리 이름과 굵기를 기반으로 실제 폰트 파일 이름을 추론 (예: Pretendard-Bold)
function getFontFileName(fontFamily, fontWeight) {
  const family = fontFamily.replace(/{|}/g, '');
  const weight = fontWeight.replace(/{|}/g, '');

  switch (weight.toLowerCase()) {
    case 'bold': return `${family}-Bold`;
    case 'semibold': return `${family}-SemiBold`;
    case 'medium': return `${family}-Medium`;
    case 'regular': return `${family}-Regular`;
    default: return family;
  }
}

// 퍼센트 문자열을 CGFloat (0.0 ~ 1.0) 또는 100% 기준으로 변환
function parsePercentageToFloat(value) {
  if (typeof value === 'string' && value.endsWith('%')) {
    return parseFloat(value.slice(0, -1)) / 100.0;
  }
  return parseFloat(value);
}

// letterSpacing (트래킹) 값을 포인트 단위로 변환 (폰트 사이즈에 비례)
function calculateKerning(fontSize, letterSpacing) {
    if (typeof letterSpacing === 'string' && letterSpacing.endsWith('%')) {
        const percentage = parseFloat(letterSpacing.slice(0, -1));
        return (percentage / 100) * fontSize;
    }
    return parseFloat(letterSpacing);
}

// --- 3. 커스텀 포맷터 등록 ---
// StyleDictionary 객체에 직접 registerFormat을 호출합니다.
StyleDictionary.registerFormat({
  name: 'swift/typography',
  formatter: function({ dictionary, platform, options, file }) {
    const typographyTokens = dictionary.allTokens
      .filter(token => token.attributes.category === 'typography');

    let output = [];

    // 파일 헤더
    if (options.fileHeader && Array.isArray(options.fileHeader.text)) {
      output.push(options.fileHeader.text.join('\n'));
    } else if (typeof options.fileHeader === 'object' && typeof options.fileHeader.text === 'function') {
      output.push(options.fileHeader.text({ file, dictionary, platform }).join('\n'));
    }

    // import 문
    if (options.import && Array.isArray(options.import)) {
      output.push(options.import.map(imp => `import ${imp}`).join('\n'));
    }
    output.push('\n');

    // UIFont.Weight Extension
    output.push(`
// MARK: - UIFont.Weight Extension for Style Dictionary Font Weights
extension UIFont.Weight {
    public static func from(styleDictionaryWeight weight: String) -> UIFont.Weight {
        switch weight.lowercased() {
        case "bold": return .bold
        case "semibold": return .semibold
        case "medium": return .medium
        case "regular": return .regular
        default: return .regular
        }
    }
}
`);

    // UIFont Extension for typography styles
    output.push(`
// MARK: - Typography Styles
extension UIFont {
`);

    typographyTokens.forEach(token => {
      const tokenName = token.name;
      const value = token.original.value;

      const fontFamily = dictionary.getProp(value.fontFamily).value;
      const fontWeight = dictionary.getProp(value.fontWeight).value;
      const fontSize = parseFloat(dictionary.getProp(value.fontSize).value);
      const lineHeight = parsePercentageToFloat(dictionary.getProp(value.lineHeight).value);
      const letterSpacing = calculateKerning(fontSize, dictionary.getProp(value.letterSpacing).value);

      const uiKitWeight = getUIFontWeight(fontWeight);
      const fontFileName = getFontFileName(fontFamily, fontWeight);

      output.push(`
    ${options.accessLevel || 'internal'} static func ${tokenName}() -> UIFont {
        let font = UIFont(name: "${fontFileName}", size: ${fontSize}.0) ?? .systemFont(ofSize: ${fontSize}.0, weight: ${uiKitWeight})
        return font
    }
`);
    });
    output.push(`
} // end of extension UIFont
`);

    // String Extension for attributed text
    output.push(`
extension String {
    // Helper to apply typography styles to NSAttributedString
    ${options.accessLevel || 'internal'} func attributed(for typographyStyle: (UIFont) -> UIFont, lineHeight: CGFloat, letterSpacing: CGFloat) -> NSAttributedString {
        let font = typographyStyle(UIFont.systemFont(ofSize: 1.0)) // Pass a dummy font to the style function
        
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineHeightMultiple = lineHeight
        
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .kern: letterSpacing,
            .paragraphStyle: paragraphStyle
        ]
        return NSAttributedString(string: self, attributes: attributes)
    }

    // Convenience methods for each typography style
`);

    typographyTokens.forEach(token => {
      const tokenName = token.name;
      const value = token.original.value;

      const lineHeight = parsePercentageToFloat(dictionary.getProp(value.lineHeight).value);
      const letterSpacing = calculateKerning(
        parseFloat(dictionary.getProp(value.fontSize).value),
        dictionary.getProp(value.letterSpacing).value
      );

      output.push(`
    ${options.accessLevel || 'internal'} var ${tokenName}Attributed: NSAttributedString {
        return self.attributed(for: UIFont.${tokenName}, lineHeight: ${lineHeight}, letterSpacing: ${letterSpacing})
    }
`);
    });
    output.push(`
} // end of extension String
`);

    return output.join('\n');
  }
});


// --- 4. Style Dictionary 설정 및 빌드 실행 ---
// 공식 문서의 첫 번째 예시를 따릅니다.
// config.json 파일의 내용을 기반으로 Style Dictionary 인스턴스를 생성하고 빌드합니다.
StyleDictionary.extend(__dirname + '/config.json').buildAllPlatforms();

console.log('Style Dictionary build process initiated.');