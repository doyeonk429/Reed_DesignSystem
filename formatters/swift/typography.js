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
  // 실제 폰트 파일명이 토큰의 fontWeight와 정확히 일치하지 않을 경우 이 함수를 수정해야 합니다.
  function getFontFileName(fontFamily, fontWeight) {
    const family = fontFamily.replace(/{|}/g, '');
    const weight = fontWeight.replace(/{|}/g, '');
  
    switch (weight.toLowerCase()) {
      case 'bold': return `${family}-Bold`;
      case 'semibold': return `${family}-SemiBold`;
      case 'medium': return `${family}-Medium`;
      case 'regular': return `${family}-Regular`;
      default: return family; // 기본적으로 패밀리 이름만 반환
    }
  }
  
  // 퍼센트 문자열을 CGFloat (0.0 ~ 1.0) 또는 100% 기준으로 변환
  function parsePercentageToFloat(value) {
    if (typeof value === 'string' && value.endsWith('%')) {
      return parseFloat(value.slice(0, -1)) / 100.0;
    }
    return parseFloat(value);
  }
  
  // letterSpacing (트래킹) 값을 포인트 단위로 변환
  // Figma/Sketch의 트래킹 값은 보통 1/1000 em 단위이므로, 폰트 사이즈에 비례합니다.
  function calculateKerning(fontSize, letterSpacing) {
      if (typeof letterSpacing === 'string' && letterSpacing.endsWith('%')) {
          const percentage = parseFloat(letterSpacing.slice(0, -1));
          // iOS의 NSKernAttributeName은 포인트 단위이므로, 폰트 사이즈에 비례하여 계산
          return (percentage / 100) * fontSize;
      }
      // 다른 단위 처리 (px, pt 등)
      return parseFloat(letterSpacing); // 숫자인 경우 그대로 (pt로 가정)
  }
  
  module.exports = {
    // Swift UIKit 폰트 스타일을 생성하는 커스텀 포맷터
    'swift/typography': function({ dictionary, platform, options, file }) {
      const typographyTokens = dictionary.allTokens
        .filter(token => token.attributes.category === 'typography');
  
      let output = [];
  
      // 파일 헤더 추가
      if (options.fileHeader && Array.isArray(options.fileHeader.text)) {
        output.push(options.fileHeader.text.join('\n'));
      } else if (typeof options.fileHeader === 'object' && typeof options.fileHeader.text === 'function') {
        output.push(options.fileHeader.text({ file, dictionary, platform }).join('\n'));
      }
  
      // import 문 추가
      if (options.import && Array.isArray(options.import)) {
        output.push(options.import.map(imp => `import ${imp}`).join('\n'));
      }
      output.push('\n'); // import 문과 코드 사이에 빈 줄
  
      // UIFont.Weight 매핑을 위한 확장 (선택 사항: 필요하다면)
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
  
      // UIFont 및 NSAttributedString.Key 속성 생성을 위한 확장
      output.push(`
  // MARK: - Typography Styles
  extension UIFont {
  `);
  
      typographyTokens.forEach(token => {
        const tokenName = token.name; // 'Title1Bold', 'Heading1Semibold' 등
        const value = token.original.value; // 참조된 실제 값 객체 (예: {fontFamily: "{Pretendard}"...})
  
        // 참조 해결 (resolveReference)을 통해 실제 값 가져오기
        const fontFamily = dictionary.getProp(value.fontFamily).value;
        const fontWeight = dictionary.getProp(value.fontWeight).value;
        const fontSize = parseFloat(dictionary.getProp(value.fontSize).value);
        const lineHeight = parsePercentageToFloat(dictionary.getProp(value.lineHeight).value);
        const letterSpacing = calculateKerning(fontSize, dictionary.getProp(value.letterSpacing).value);
  
        const uiKitWeight = getUIFontWeight(fontWeight);
        const fontFileName = getFontFileName(fontFamily, fontWeight);
  
        // 폰트 생성 함수
        output.push(`
      ${options.accessLevel || 'internal'} static func ${tokenName}() -> UIFont {
          // Try to load custom font first, fallback to system font
          let font = UIFont(name: "${fontFileName}", size: ${fontSize}.0) ?? .systemFont(ofSize: ${fontSize}.0, weight: ${uiKitWeight})
          return font
      }
  `);
      });
  
      output.push(`
  } // end of extension UIFont
  
  extension String {
      // Helper to apply typography styles to NSAttributedString
      ${options.accessLevel || 'internal'} func attributed(for style: (UIFont) -> UIFont, lineHeight: CGFloat, letterSpacing: CGFloat) -> NSAttributedString {
          let font = style(UIFont.systemFont(ofSize: 1.0)) // Dummy font size, actual font is returned by style()
          
          let paragraphStyle = NSMutableParagraphStyle()
          // Calculate line height multiple if needed, or use fixed line height
          // For percentage line heights, you might need to calculate based on font size
          // A common approach is to set lineSpacing or minimumLineHeight/maximumLineHeight
          // Here, assuming lineHeight is a multiplier (e.g., 1.358 for 135.8%)
          paragraphStyle.lineHeightMultiple = lineHeight
          
          let attributes: [NSAttributedString.Key: Any] = [
              .font: font,
              .kern: letterSpacing, // Kerning (letter spacing)
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
          parseFloat(dictionary.getProp(value.fontSize).value), // Pass font size for kerning calculation
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
  };