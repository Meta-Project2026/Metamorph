# Public compatibility rules measured before correction

Pinned PHP 7.4.33 / PCRE 10.35 / 64-bit integers and Node v24.11.0, measured in
separate bounded network-none read-only Docker containers, not on the host.
[Run 40716984152](https://github.com/Meta-Project2026/Metamorph/actions/runs/40716984152),
code `d7af19b9ddb17ad04e65177828bc2d4b137a1e80`; exact public
[semantics receipt](evidence/probe-40716984152/semantics.json).
These are operator measurements; they do not establish application parity.

The selected [complete replay](validation.md) additionally measured U+2029 and
separate leading/trailing phone/engine positions for all 12 whitespace families.
Actual compiled corrected operators match pinned PHP for every value. U+2028
and U+2029 are rejected on either edge; existing anchors need no extra change.
The [ECMAScript assertion rule](https://tc39.es/ecma262/2024/multipage/text-processing.html#sec-compileassertion)
requires end-of-input without `m`; no multiline flag is present here.

| Public input | PHP 7.4 | Frozen TS operator | Corrected rule |
| --- | --- | --- | --- |
| `1`, `01`, `10`, `+1` | 1, 1, 10, 1 | Same | Preserve decimal IDs |
| Missing/null, empty, `nonnumeric`, `0x10`, `INF`, `NAN` | 0 | Same | No numeric prefix → 0 |
| `1e1`, `1E+1`, `1.9e1`, `1e-1` | 10, 10, 19, 0 | 1, 1, 1, 1 | Parse valid exponent in numeric prefix |
| `1.9`, `-1.9`, `.9`, `-1e1` | 1, -1, 0, -10 | 1, -1, 0, -1 | Truncate toward zero after scoped double conversion |
| `1e`, `1e+`, `1e1tail`, `12tail`, `1 2` | 1, 1, 10, 12, 1 | 1, 1, 1, 12, 1 | Incomplete exponent is not consumed; retain valid leading numeric part |
| ASCII space, TAB/LF/VT/FF before `1` | 1 | 1 | Leading ASCII numeric whitespace only |
| NBSP before `1`; NBSP after `1` | 0; 1 | 1; 1 | Do not apply ECMAScript Unicode whitespace coercion |
| `9007199254740993` | Exact same integer | 9007199254740992 | Preserve integral token in bigint; bind bigint directly to SQLite |
| `9223372036854775807`, `-9223372036854775808` | Exact signed 64-bit endpoints | Rounded JS Numbers | Preserve exact signed 64-bit integers |
| `9223372036854775808`, `-9223372036854775809`, `±1e19` | Saturate to signed 64-bit endpoint | Rounded Number / ±1 | Finite overflow saturates after numeric conversion |
| `1e309`, `-1e309`, `1e-999` | 0 | 1, -1, 1 | Nonfinite conversion / underflow → 0 |
| Valid `+1555440001`, `ENGINE-049`, interior/edge ASCII space | Accepted | Accepted | Preserve existing symbols and ASCII whitespace |
| Interior TAB/LF/CR/FF/VT in phone/engine | Accepted by original PCRE | Accepted | Explicit original ASCII whitespace class |
| Interior/edge NBSP; interior EM SPACE, U+2028, BOM | Rejected | Accepted | Reject Unicode whitespace in the two original character classes |
| Interior/edge NEL U+0085 | Rejected | Rejected | Preserve rejection |

The two regex classes alone change; date regexes, PHP-style trim, SQL, messages,
schema, seeds and all other application behavior remain the baseline's code.
`phpInt` is limited to the existing ID conversion call sites; this is not global
`Number(...)` coercion. Fractional/exponent/overflow conversion uses double
semantics; ordinary integral strings within 64-bit range use exact bigint.

TAB/LF/CR/FF/VT are **operator-only** diagnostic inputs: the unchanged HTTP
requestPolicy rejects control characters. No policy extension is proposed.
Application regressions use only existing canonical admissible form bytes.
This fixed matrix is not an exhaustive proof of all PHP semantics, locale,
architectures or PHP versions. Canonical G4 remains INCONCLUSIVE.

No shared-policy decision gate has been crossed: the existing TargetWorker and
admitDirectory APIs accept a new immutable bundle. The new manual caller selects
the versioned candidate using its own metadata; it never changes the baseline
WORKSHOP_CANDIDATE_SHA or substitutes the old replay provider's pin. A future
default-candidate/shared-policy replacement still requires joint owner agreement.

The new standalone workflow initially returned HTTP 404 before registration.
The existing manual public workflow now has an additive explicit
`proof=mmp049-compatibility` selection invoking the new reusable workflow. Its
default frozen reproducer remains selected by default, and PR Fast CI is unchanged.
