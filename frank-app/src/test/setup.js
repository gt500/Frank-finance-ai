import '@testing-library/jest-dom'

// FileReader mock — used by extractFromDocument for PDF/image base64 encoding
class MockFileReader {
  readAsDataURL(file) {
    this.result = `data:${file.type || 'application/pdf'};base64,dGVzdGRhdGE=`
    this.onload?.()
  }
}
global.FileReader = MockFileReader
