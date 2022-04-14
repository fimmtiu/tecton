const segmentsPerSide = 10;

/*
const squarePlus2 = x => x * x + 2;
const root = (x) => {
    Math.sqrt(x - 2);
}
*/

//scale += 1/5 * scale
//scale = 1.2 * scale

const EPSILON = 1.0 / 9007199254740992.0;

// const EPSILON = 1.0/77;


const correctScale = (scale) => scale * (1 + EPSILON);

const uncorrectScale = (correctedScale) =>  correctedScale / (1 + EPSILON);

function getUncorrectedScaleFromUnitUV(unitUV) {
    return Math.tan(Math.pow(Math.abs(unitUV), 1 / 6) * (Math.PI / 4));
}

function getUnitUVFromUncorrectedScale(uncorrectedScale) {
    return Math.pow(Math.atan(uncorrectedScale) / (Math.PI / 4), 6)
}

function getScaleFromUnitUV(unitUV) {
    return correctScale(getUncorrectedScaleFromUnitUV(unitUV));
}

function getUnitUVFromScale(scale) {
    return getUnitUVFromUncorrectedScale(uncorrectScale(scale));
}

// Takes a [0..segmentsPerSide] coordinate.
// Returns a coordinate in the range [-1, 1], where 0 is the center.
function getUvFromCoordinate(coordinate) {
    return (coordinate - segmentsPerSide / 2) * getScaleFromUnitUV(coordinate / segmentsPerSide * 2 - 1);
}

// Takes a [-segmentsPerSide/2, segmentsPerSide/2] number.
// Returns a [0..segmentsPerSide] number.
function getCoordinateFromUv(correctedScaledUV) {
    console.log(`woop csuv ${correctedScaledUV}, csuv/sps*2 ${correctedScaledUV / segmentsPerSide * 2}, m1 ${correctedScaledUV / segmentsPerSide * 2 - 1}, m1x ${correctedScaledUV / (segmentsPerSide * 2 - 1)}`);
    correctedScaledUV = getUnitUVFromScale(correctedScaledUV) / (segmentsPerSide * 2);
    return correctedScaledUV + segmentsPerSide / 2;
};

function uvWithTangentAdjustment(n) {
    let unitUV = n / segmentsPerSide * 2 - 1; // A coordinate in the range [-1, 1], where 0 is the center.
    let cellSpaceUV = n - segmentsPerSide / 2; // A coordinate in the range [-segmentsPerSide/2, segmentsPerSide/2].
    let scale = Math.tan(Math.pow(Math.abs(unitUV), 1/6) * (Math.PI / 4));
    scale += (1.0 / 9007199254740992.0) * scale; // correct tiny floating-point inaccuracies
    return cellSpaceUV * scale;
}


function testInverse(x, fn1, fn2) {
    console.log("");
    console.log(`${fn1.name} <-> ${fn2.name}`);
    let originalUv = uvWithTangentAdjustment(x);
    let result = fn1(x);
    let inverted = fn2(result);
    console.log(JSON.stringify({x, originalUv, result, inverted}, null, 2));

}


testInverse(8, correctScale, uncorrectScale);
testInverse(8, getUncorrectedScaleFromUnitUV, getUnitUVFromUncorrectedScale);
testInverse(8, getScaleFromUnitUV, getUnitUVFromScale);
testInverse(8, getUvFromCoordinate, getCoordinateFromUv);
