import      _                                /**/ from 'lodash'
import      { expect }                            from 'chai'
//
import      * as CK                               from '@freeword/meta/checks'
import type * as TY                               from '@freeword/meta'
import      * as TH                               from '../TestHelpers.ts'

const { Examples } = TH

/* eslint-disable no-useless-concat */

describe('Validation Reporting', () => {
  describe("Checker.report()", () => {
    const goodReportKeys = ['ok', 'act', 'tmi', 'val']
    // formerly also: result, badpropsStr, checkname, obj, paths, val
    const badReportKeys = ['badprops', 'extensions', 'message', 'messages', 'name', 'ok', 'success']
    // plus hidden keys: code, logline, paths, result, success, tmi, val // , 'badpropsStr', 'checkname', 'code', 'logline',
    const badReportExtKeys = ['badprops', 'messages', 'subj']
    const originalStory = { fleas: "Adam had'm" }; Object.freeze(originalStory)

    describe('on success', () => {
      it("returns empty list of messages, errors, and ok: true on ok", () => {
        const report = CK.handleish.report(Examples.Strings.idsegstr, originalStory)
        expect(report).to.have.keys(goodReportKeys)
        expect(report).to.not.have.property('extensions')
        expect(report).to.eql({
          ok: true, act: 'record handle', val: Examples.Strings.idsegstr, tmi: originalStory,
          // result: undefined, name: 'Valid', paths: [], message: '', logline: '', checkname: 'Valid',
          // badprops: {}, badpropsStr: "", obj: Examples.Strings.idsegstr, val: undefined,
        })
      })
    })

    describe('on failure', () => {
      const testString = '12345678901234567890123456789012345678901 '
      const fullPathed = {
        it: {
          code: 'too_big',
          path: [],
          propmsg: "«'12345678901234567890123456789012345678901 '»",
          badprop: '12345678901234567890123456789012345678901 ',
          badpropStr: "«'12345678901234567890123456789012345678901 '»",
          issues: [
            { code: 'too_big', maximum: 36, type: 'string', inclusive: true, exact: false, message: 'is too long: «41» vs «36» available', path: [], badprop: '12345678901234567890123456789012345678901 ', badpropStr: "«'12345678901234567890123456789012345678901 '»" },
            { validation: 'regex', code: 'invalid_string', message: 'should have only lowercase plain letters/_/numbers with a letter first', path: [], badprop: '12345678901234567890123456789012345678901 ', badpropStr: "«'12345678901234567890123456789012345678901 '»" },
          ],
          message: 'is too long: «41» vs «36» available and should have only lowercase plain letters/_/numbers with a letter first',
        },
      }
      it("returns messages, errors, and ok: false on failure", () => {
        //
        const report = CK.handleish.report(testString, originalStory)
        //
        expect(report).to.have.keys(badReportKeys)
        expect(report).property('ok').to.eql(false)
        expect(report).property('message').to.exist.and.match(
          /record handle issues: «'12345678901234567890123456789012345678901 '» is too long: «41» vs «36» available and should have only lowercase plain letters\/_\/numbers with a letter first/,
        )
        expect(report).property('extensions').property('subj').to.equal(testString)
      })
      describe('properties', () => {
        const report = CK.handleish.report(testString, originalStory) as TY.BadParseReport<string, any>
        it('has the expected keys', () => {
          expect(report).to.have.keys(badReportKeys)
        })
        it('has the responsible checker', () => {
          expect(report).property('checker').to.equal(CK.handleish)
        })
        it('.name is named for the error', () => {
          expect(report).property('name').to.equal('ZodError')
        })
        it('.message has the summary message', () => {
          expect(report).property('message').to.eql(`record handle issues: «'12345678901234567890123456789012345678901 '» is too long: «41» vs «36» available and should have only lowercase plain letters/_/numbers with a letter first`)
        })
        it('.ok is false for a TS tagged union', () => {
          expect(report.ok).to.be.false
        })
        it('has the stacktrace', () => {
          expect(report.stack).to.be.a('string').matches(/.*ValidationReport.test.ts.*/)
        })
        it('has the expected extensions', () => {
          expect(report).property('extensions').to.have.keys([...badReportExtKeys, 'fleas'])
        })
        it('.issues has the original errors', () => {
          expect(report.issues).to.be.an('array').of.length(2)
        })
      })
      describe('.extensions', () => {
        const report = CK.handleish.report(testString, originalStory) as TY.BadParseReport<string, any>
        const { extensions } = report ?? {}
        it('has the expected keys', () => {
          expect(extensions).to.have.keys([...badReportExtKeys, 'fleas'])
        })
        it('has inlined the provided story', () => {
          expect(extensions).property('fleas').to.equal("Adam had'm")
        })
        it('.subj has the subject value', () => {
          expect(extensions.subj).to.eql(testString)
        })
        it('.badprops has the offending badprops', () => {
          expect(extensions).property('badprops').to.eql({
            it: testString,
          })
        })
        it('.messages has the individual messages', () => {
          expect(extensions).property('messages').to.eql({
            it: 'is too long: «41» vs «36» available and should have only lowercase plain letters/_/numbers with a letter first',
          })
        })
        it('.pathed has the pathed messages', () => {
          expect(extensions.pathed).to.eql(fullPathed)
        })
        it('.checker has the responsible checker', () => {
          expect(extensions.checker).to.equal(CK.handleish)
        })
        it('.issues has the original errors', () => {
          expect(extensions.issues).to.be.an('array').of.length(2).eql(fullPathed.it.issues)
        })
      })

      it("returns a humane message", () => {
        const report = CK.handleish.report(Examples.markdown) as TY.BadParseReport<string, any>
        expect(report?.success).to.be.false
        const { message } = report
        expect(message).to.exist.and.match(
          /record handle issues: «"~\^n# Product Description.*should be all lowercase; is too long: «1_425» vs «36» available; and should have only lowercase plain letters\/_\/numbers with a letter first/,
        )
      })
    })
  })
})
