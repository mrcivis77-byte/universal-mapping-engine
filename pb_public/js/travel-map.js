/**
 * Theme Park Travel Map Module
 * Illustrated map styles with proximity detection for cultural attractions
 * Handles proximity alerts and animated attraction icons
 */


// Mexico land mask (Natural Earth 50m simplified) + approximate arid zones

// Mexico land mask (Natural Earth 50m simplified), arid zones, Ria de Chelem, Progreso pier
MEX_RINGS=[[[-117.128,32.533],[-116.842,32.555],[-116.556,32.576],[-116.27,32.598],[-115.984,32.619],[-115.698,32.64],[-115.411,32.662],[-115.125,32.683],[-114.839,32.705],[-114.725,32.715],[-114.788,32.565],[-114.836,32.508],[-114.362,32.36],[-113.887,32.212],[-113.413,32.064],[-112.939,31.916],[-112.465,31.768],[-111.99,31.62],[-111.516,31.472],[-111.042,31.324],[-110.689,31.325],[-110.335,31.326],[-109.982,31.326],[-109.628,31.327],[-109.275,31.327],[-108.921,31.328],[-108.568,31.329],[-108.214,31.329],[-108.214,31.442],[-108.213,31.554],[-108.213,31.667],[-108.212,31.779],[-107.992,31.778],[-107.772,31.777],[-107.552,31.776],[-107.333,31.775],[-107.113,31.774],[-106.893,31.772],[-106.673,31.771],[-106.453,31.77],[-106.436,31.764],[-106.347,31.679],[-106.256,31.545],[-106.148,31.451],[-106.024,31.398],[-105.813,31.241],[-105.514,30.981],[-105.276,30.807],[-105.098,30.721],[-104.979,30.646],[-104.918,30.583],[-104.836,30.448],[-104.681,30.134],[-104.681,29.991],[-104.622,29.854],[-104.504,29.678],[-104.401,29.574],[-104.312,29.542],[-104.216,29.48],[-104.111,29.386],[-103.99,29.323],[-103.853,29.291],[-103.664,29.207],[-103.423,29.071],[-103.258,29.001],[-103.168,28.998],[-103.09,29.042],[-103.023,29.132],[-102.957,29.19],[-102.892,29.216],[-102.866,29.258],[-102.878,29.315],[-102.834,29.444],[-102.734,29.644],[-102.615,29.752],[-102.476,29.769],[-102.386,29.807],[-102.343,29.865],[-102.269,29.871],[-102.163,29.825],[-101.991,29.796],[-101.752,29.782],[-101.612,29.787],[-101.569,29.809],[-101.546,29.808],[-101.545,29.784],[-101.509,29.773],[-101.44,29.777],[-101.38,29.743],[-101.304,29.634],[-101.039,29.46],[-101.016,29.401],[-100.924,29.315],[-100.755,29.183],[-100.659,29.069],[-100.636,28.973],[-100.55,28.821],[-100.399,28.614],[-100.332,28.503],[-100.348,28.486],[-100.336,28.428],[-100.296,28.328],[-100.221,28.243],[-100.112,28.173],[-100.001,28.048],[-99.89,27.867],[-99.754,27.73],[-99.595,27.636],[-99.505,27.548],[-99.484,27.467],[-99.486,27.398],[-99.51,27.34],[-99.5,27.285],[-99.455,27.234],[-99.44,27.17],[-99.458,27.082],[-99.457,27.057],[-99.444,27.037],[-99.302,26.885],[-99.23,26.762],[-99.172,26.566],[-99.108,26.447],[-99.015,26.399],[-98.873,26.381],[-98.765,26.34],[-98.691,26.276],[-98.598,26.238],[-98.486,26.225],[-98.378,26.182],[-98.275,26.111],[-98.083,26.064],[-97.801,26.042],[-97.587,25.984],[-97.44,25.891],[-97.376,25.872],[-97.358,25.871],[-97.35,25.885],[-97.339,25.911],[-97.282,25.942],[-97.146,25.961],[-97.164,25.755],[-97.225,25.585],[-97.424,25.233],[-97.507,25.015],[-97.668,24.39],[-97.717,23.981],[-97.729,23.788],[-97.743,23.761],[-97.727,23.732],[-97.766,23.306],[-97.745,22.942],[-97.758,22.886],[-97.817,22.776],[-97.858,22.625],[-97.842,22.557],[-97.842,22.51],[-97.782,22.279],[-97.763,22.106],[-97.585,21.809],[-97.485,21.705],[-97.36,21.615],[-97.315,21.564],[-97.337,21.438],[-97.388,21.374],[-97.409,21.273],[-97.434,21.356],[-97.424,21.465],[-97.385,21.524],[-97.383,21.567],[-97.457,21.612],[-97.59,21.762],[-97.754,22.027],[-97.638,21.604],[-97.598,21.536],[-97.567,21.508],[-97.515,21.478],[-97.501,21.432],[-97.501,21.398],[-97.357,21.104],[-97.195,20.8],[-97.186,20.717],[-97.121,20.615],[-96.709,20.188],[-96.456,19.87],[-96.368,19.567],[-96.315,19.473],[-96.29,19.344],[-96.124,19.199],[-96.073,19.106],[-95.985,19.054],[-95.913,18.897],[-95.778,18.806],[-95.81,18.804],[-95.928,18.85],[-95.92,18.82],[-95.821,18.755],[-95.627,18.691],[-95.578,18.69],[-95.655,18.724],[-95.72,18.768],[-95.697,18.775],[-95.561,18.719],[-95.182,18.701],[-95.015,18.571],[-94.798,18.515],[-94.682,18.348],[-94.546,18.175],[-94.46,18.167],[-94.392,18.166],[-94.189,18.195],[-93.873,18.304],[-93.764,18.358],[-93.552,18.43],[-93.228,18.444],[-93.127,18.423],[-92.885,18.469],[-92.769,18.524],[-92.729,18.575],[-92.71,18.612],[-92.485,18.665],[-92.441,18.675],[-92.213,18.685],[-92.103,18.704],[-91.974,18.716],[-91.88,18.638],[-91.88,18.6],[-91.943,18.563],[-91.914,18.529],[-91.803,18.471],[-91.6,18.447],[-91.534,18.457],[-91.44,18.542],[-91.275,18.624],[-91.279,18.721],[-91.308,18.773],[-91.356,18.777],[-91.368,18.806],[-91.334,18.877],[-91.343,18.901],[-91.446,18.833],[-91.469,18.833],[-91.458,18.865],[-91.437,18.89],[-91.136,19.038],[-91.059,19.098],[-90.955,19.152],[-90.739,19.352],[-90.693,19.73],[-90.65,19.796],[-90.507,19.912],[-90.492,19.947],[-90.482,20.026],[-90.486,20.224],[-90.478,20.38],[-90.484,20.556],[-90.458,20.714],[-90.435,20.758],[-90.353,21.009],[-90.183,21.121],[-89.888,21.253],[-89.82,21.275],[-88.879,21.414],[-88.747,21.448],[-88.585,21.539],[-88.467,21.569],[-88.251,21.567],[-88.185,21.579],[-88.172,21.591],[-88.132,21.616],[-88.007,21.604],[-87.774,21.55],[-87.689,21.536],[-87.48,21.472],[-87.251,21.447],[-87.218,21.458],[-87.188,21.477],[-87.164,21.514],[-87.188,21.546],[-87.211,21.544],[-87.249,21.527],[-87.296,21.525],[-87.387,21.551],[-87.369,21.574],[-87.276,21.572],[-87.216,21.582],[-87.128,21.621],[-87.035,21.592],[-86.912,21.463],[-86.824,21.422],[-86.817,21.234],[-86.804,21.2],[-86.772,21.151],[-86.816,21.005],[-86.865,20.885],[-86.926,20.786],[-87.06,20.631],[-87.221,20.507],[-87.421,20.231],[-87.467,20.102],[-87.466,19.999],[-87.432,19.898],[-87.442,19.862],[-87.466,19.824],[-87.507,19.827],[-87.586,19.779],[-87.688,19.637],[-87.69,19.594],[-87.645,19.554],[-87.587,19.573],[-87.512,19.575],[-87.469,19.586],[-87.425,19.583],[-87.435,19.502],[-87.483,19.444],[-87.513,19.426],[-87.567,19.416],[-87.628,19.383],[-87.659,19.352],[-87.656,19.258],[-87.622,19.25],[-87.551,19.321],[-87.509,19.317],[-87.501,19.288],[-87.594,19.046],[-87.653,18.799],[-87.734,18.655],[-87.762,18.446],[-87.804,18.357],[-87.853,18.269],[-87.882,18.274],[-87.96,18.441],[-88.039,18.484],[-88.056,18.524],[-88.011,18.727],[-88.032,18.839],[-88.074,18.834],[-88.127,18.773],[-88.197,18.72],[-88.195,18.643],[-88.276,18.515],[-88.296,18.472],[-88.372,18.482],[-88.461,18.477],[-88.523,18.446],[-88.586,18.291],[-88.744,18.072],[-88.806,17.966],[-88.857,17.929],[-88.898,17.915],[-88.943,17.94],[-89.05,18.0],[-89.134,17.971],[-89.162,17.902],[-89.161,17.815],[-89.372,17.815],[-89.729,17.815],[-90.184,17.816],[-90.622,17.816],[-90.989,17.816],[-90.99,17.621],[-90.992,17.447],[-90.993,17.252],[-91.196,17.254],[-91.41,17.256],[-91.392,17.236],[-91.319,17.2],[-91.224,17.112],[-91.112,16.976],[-90.976,16.868],[-90.816,16.787],[-90.711,16.708],[-90.66,16.631],[-90.634,16.565],[-90.634,16.511],[-90.576,16.468],[-90.471,16.44],[-90.417,16.391],[-90.417,16.351],[-90.45,16.261],[-90.46,16.162],[-90.447,16.073],[-90.522,16.071],[-90.703,16.071],[-90.98,16.071],[-91.234,16.071],[-91.434,16.07],[-91.737,16.07],[-91.819,15.932],[-91.957,15.703],[-92.082,15.496],[-92.187,15.321],[-92.204,15.275],[-92.204,15.238],[-92.075,15.074],[-92.099,15.027],[-92.144,15.002],[-92.159,14.964],[-92.156,14.901],[-92.186,14.818],[-92.176,14.761],[-92.16,14.691],[-92.187,14.63],[-92.209,14.571],[-92.235,14.545],[-92.265,14.568],[-92.531,14.84],[-92.809,15.139],[-92.918,15.236],[-93.024,15.31],[-93.167,15.448],[-93.541,15.75],[-93.734,15.888],[-93.916,16.054],[-94.079,16.145],[-94.24,16.205],[-94.311,16.239],[-94.374,16.285],[-94.409,16.287],[-94.426,16.226],[-94.37,16.195],[-94.303,16.169],[-94.25,16.168],[-94.193,16.146],[-94.028,16.062],[-94.001,16.019],[-94.471,16.187],[-94.662,16.202],[-94.682,16.228],[-94.587,16.316],[-94.617,16.348],[-94.651,16.352],[-94.753,16.291],[-94.791,16.287],[-94.797,16.327],[-94.793,16.365],[-94.859,16.42],[-94.9,16.417],[-94.935,16.379],[-95.024,16.306],[-95.021,16.278],[-94.846,16.247],[-94.786,16.229],[-94.799,16.21],[-94.949,16.21],[-95.134,16.177],[-95.464,15.975],[-95.772,15.888],[-96.214,15.693],[-96.409,15.683],[-96.511,15.652],[-96.808,15.726],[-97.185,15.909],[-97.755,15.967],[-98.139,16.206],[-98.52,16.305],[-98.762,16.535],[-98.908,16.545],[-99.002,16.581],[-99.348,16.665],[-99.691,16.72],[-100.025,16.921],[-100.243,16.984],[-100.432,17.064],[-100.848,17.2],[-101.002,17.276],[-101.148,17.393],[-101.385,17.514],[-101.487,17.615],[-101.6,17.652],[-101.762,17.842],[-101.847,17.922],[-101.919,17.96],[-101.996,17.973],[-102.217,17.957],[-102.547,18.041],[-102.7,18.063],[-103.019,18.187],[-103.442,18.325],[-103.58,18.484],[-103.699,18.633],[-103.912,18.828],[-104.046,18.912],[-104.277,19.011],[-104.405,19.091],[-104.603,19.153],[-104.938,19.309],[-105.045,19.443],[-105.108,19.562],[-105.286,19.706],[-105.482,19.976],[-105.532,20.075],[-105.57,20.228],[-105.616,20.316],[-105.669,20.386],[-105.642,20.436],[-105.543,20.498],[-105.377,20.512],[-105.26,20.579],[-105.245,20.634],[-105.252,20.669],[-105.327,20.753],[-105.42,20.775],[-105.492,20.777],[-105.511,20.809],[-105.456,20.844],[-105.394,20.926],[-105.302,21.027],[-105.237,21.119],[-105.225,21.25],[-105.233,21.38],[-105.209,21.491],[-105.431,21.618],[-105.457,21.672],[-105.527,21.818],[-105.649,21.988],[-105.646,22.327],[-105.792,22.627],[-105.943,22.777],[-106.022,22.829],[-106.235,23.061],[-106.402,23.196],[-106.567,23.449],[-106.729,23.611],[-106.935,23.881],[-107.085,24.016],[-107.765,24.472],[-107.727,24.472],[-107.527,24.36],[-107.494,24.369],[-107.489,24.424],[-107.512,24.489],[-107.549,24.505],[-107.602,24.49],[-107.674,24.504],[-107.71,24.525],[-107.817,24.539],[-107.951,24.615],[-108.009,24.694],[-108.015,24.783],[-108.208,24.975],[-108.281,25.082],[-108.243,25.074],[-108.192,25.031],[-108.14,25.018],[-108.08,25.018],[-108.036,25.035],[-108.051,25.067],[-108.093,25.094],[-108.374,25.194],[-108.466,25.265],[-108.696,25.383],[-108.751,25.424],[-108.787,25.538],[-108.844,25.543],[-108.893,25.512],[-109.029,25.48],[-109.063,25.517],[-109.068,25.552],[-108.973,25.588],[-108.885,25.696],[-108.887,25.733],[-108.935,25.69],[-109.008,25.642],[-109.084,25.615],[-109.196,25.593],[-109.254,25.609],[-109.304,25.633],[-109.385,25.727],[-109.426,26.033],[-109.354,26.138],[-109.271,26.243],[-109.2,26.305],[-109.159,26.258],[-109.117,26.253],[-109.146,26.306],[-109.216,26.355],[-109.241,26.405],[-109.243,26.45],[-109.276,26.534],[-109.483,26.71],[-109.676,26.697],[-109.755,26.703],[-109.828,26.77],[-109.891,26.883],[-109.922,26.978],[-109.926,27.029],[-109.944,27.079],[-110.277,27.162],[-110.377,27.233],[-110.478,27.323],[-110.519,27.396],[-110.561,27.45],[-110.593,27.544],[-110.615,27.654],[-110.578,27.796],[-110.53,27.864],[-110.759,27.915],[-110.849,27.918],[-110.921,27.889],[-110.986,27.926],[-111.121,27.967],[-111.282,28.115],[-111.472,28.384],[-111.68,28.471],[-111.747,28.564],[-111.832,28.648],[-111.907,28.752],[-111.919,28.798],[-111.941,28.823],[-112.045,28.896],[-112.162,29.019],[-112.192,29.118],[-112.223,29.269],[-112.301,29.323],[-112.378,29.348],[-112.393,29.42],[-112.389,29.46],[-112.415,29.536],[-112.573,29.72],[-112.653,29.87],[-112.697,29.917],[-112.738,29.985],[-112.759,30.126],[-112.825,30.3],[-112.952,30.51],[-113.058,30.651],[-113.11,30.793],[-113.087,30.938],[-113.105,31.027],[-113.119,31.048],[-113.108,31.077],[-113.073,31.061],[-113.043,31.087],[-113.047,31.179],[-113.084,31.207],[-113.186,31.236],[-113.231,31.256],[-113.481,31.294],[-113.623,31.346],[-113.633,31.468],[-113.7,31.523],[-113.759,31.558],[-113.948,31.629],[-113.977,31.593],[-114.003,31.525],[-114.081,31.51],[-114.149,31.507],[-114.264,31.554],[-114.549,31.734],[-114.609,31.762],[-114.698,31.777],[-114.741,31.806],[-114.934,31.901],[-114.895,31.851],[-114.84,31.799],[-114.79,31.647],[-114.848,31.538],[-114.882,31.156],[-114.845,31.08],[-114.761,30.959],[-114.703,30.765],[-114.685,30.621],[-114.633,30.507],[-114.65,30.238],[-114.63,30.156],[-114.55,30.022],[-114.403,29.896],[-114.373,29.83],[-114.179,29.734],[-114.062,29.61],[-113.829,29.439],[-113.755,29.367],[-113.545,29.102],[-113.538,29.023],[-113.5,28.927],[-113.382,28.947],[-113.329,28.873],[-113.335,28.839],[-113.321,28.813],[-113.259,28.819],[-113.206,28.799],[-113.094,28.512],[-113.034,28.473],[-112.957,28.456],[-112.871,28.424],[-112.865,28.351],[-112.868,28.292],[-112.796,28.207],[-112.808,28.092],[-112.749,27.995],[-112.758,27.901],[-112.734,27.826],[-112.553,27.657],[-112.329,27.523],[-112.283,27.347],[-112.191,27.187],[-112.098,27.146],[-112.004,27.079],[-112.016,27.01],[-112.009,26.967],[-111.883,26.84],[-111.863,26.679],[-111.754,26.573],[-111.723,26.564],[-111.699,26.581],[-111.779,26.687],[-111.817,26.756],[-111.822,26.865],[-111.795,26.88],[-111.57,26.708],[-111.546,26.579],[-111.47,26.507],[-111.465,26.408],[-111.419,26.35],[-111.405,26.265],[-111.332,26.125],[-111.33,25.931],[-111.292,25.79],[-111.15,25.573],[-111.034,25.527],[-111.014,25.42],[-110.894,25.144],[-110.756,24.995],[-110.687,24.868],[-110.677,24.789],[-110.729,24.672],[-110.735,24.59],[-110.659,24.341],[-110.547,24.214],[-110.421,24.183],[-110.4,24.165],[-110.41,24.131],[-110.367,24.1],[-110.32,24.139],[-110.297,24.195],[-110.321,24.259],[-110.325,24.306],[-110.304,24.339],[-110.263,24.345],[-110.023,24.175],[-109.983,24.109],[-109.893,24.033],[-109.811,23.939],[-109.776,23.865],[-109.711,23.804],[-109.677,23.662],[-109.51,23.598],[-109.421,23.48],[-109.415,23.406],[-109.458,23.215],[-109.496,23.16],[-109.63,23.079],[-109.728,22.982],[-109.823,22.922],[-109.923,22.886],[-110.006,22.894],[-110.086,23.005],[-110.181,23.342],[-110.244,23.412],[-110.289,23.518],[-110.363,23.605],[-110.63,23.737],[-110.765,23.877],[-110.896,23.97],[-111.036,24.105],[-111.419,24.329],[-111.578,24.443],[-111.683,24.556],[-111.75,24.554],[-111.802,24.543],[-111.822,24.573],[-111.825,24.632],[-111.848,24.67],[-112.073,24.84],[-112.119,24.934],[-112.129,25.043],[-112.078,25.324],[-112.056,25.488],[-112.07,25.573],[-112.093,25.584],[-112.115,25.63],[-112.12,25.766],[-112.174,25.913],[-112.377,26.214],[-112.526,26.273],[-112.658,26.317],[-113.021,26.583],[-113.119,26.717],[-113.143,26.792],[-113.156,26.946],[-113.206,26.857],[-113.272,26.791],[-113.426,26.796],[-113.599,26.721],[-113.701,26.791],[-113.757,26.871],[-113.841,26.967],[-113.936,26.985],[-113.996,26.988],[-114.11,27.106],[-114.202,27.144],[-114.333,27.158],[-114.445,27.218],[-114.48,27.284],[-114.498,27.376],[-114.54,27.431],[-114.716,27.54],[-114.859,27.659],[-114.994,27.736],[-115.033,27.799],[-115.036,27.842],[-114.824,27.83],[-114.57,27.784],[-114.448,27.797],[-114.373,27.841],[-114.301,27.873],[-114.289,27.839],[-114.302,27.776],[-114.233,27.718],[-114.137,27.671],[-114.069,27.676],[-114.135,27.727],[-114.175,27.831],[-114.157,27.868],[-114.158,27.92],[-114.253,27.908],[-114.266,27.934],[-114.185,28.013],[-114.093,28.221],[-114.048,28.426],[-114.146,28.605],[-114.309,28.73],[-114.664,29.095],[-114.876,29.282],[-114.937,29.352],[-114.994,29.384],[-115.166,29.427],[-115.311,29.532],[-115.565,29.68],[-115.674,29.756],[-115.749,29.936],[-115.808,29.96],[-115.79,30.084],[-115.816,30.304],[-115.858,30.36],[-115.996,30.414],[-116.029,30.564],[-116.035,30.705],[-116.062,30.804],[-116.296,30.971],[-116.31,31.051],[-116.31,31.127],[-116.333,31.203],[-116.458,31.361],[-116.61,31.499],[-116.662,31.565],[-116.668,31.699],[-116.722,31.735],[-116.702,31.744],[-116.652,31.74],[-116.624,31.758],[-116.621,31.851],[-116.848,31.997],[-116.914,32.199],[-117.035,32.305],[-117.063,32.344],[-117.128,32.533]],[[-86.94,20.303],[-86.991,20.272],[-87.019,20.382],[-86.978,20.49],[-86.928,20.552],[-86.829,20.559],[-86.763,20.579],[-86.755,20.552],[-86.809,20.468],[-86.94,20.303]],[[-106.502,21.611],[-106.531,21.529],[-106.607,21.561],[-106.634,21.613],[-106.639,21.698],[-106.597,21.712],[-106.536,21.676],[-106.524,21.652],[-106.502,21.611]],[[-110.914,18.741],[-110.975,18.72],[-111.064,18.782],[-111.04,18.83],[-110.989,18.863],[-110.942,18.802],[-110.914,18.741]],[[-110.567,25.003],[-110.539,24.892],[-110.59,24.908],[-110.657,24.969],[-110.703,25.047],[-110.699,25.081],[-110.595,25.042],[-110.567,25.003]],[[-113.156,29.052],[-113.163,29.035],[-113.265,29.097],[-113.496,29.308],[-113.581,29.413],[-113.594,29.463],[-113.587,29.573],[-113.508,29.56],[-113.416,29.486],[-113.376,29.417],[-113.374,29.339],[-113.202,29.302],[-113.178,29.132],[-113.156,29.052]],[[-115.171,28.069],[-115.184,28.037],[-115.353,28.104],[-115.26,28.221],[-115.274,28.343],[-115.234,28.368],[-115.197,28.328],[-115.149,28.172],[-115.171,28.069]],[[-112.203,29.005],[-112.278,28.769],[-112.355,28.773],[-112.514,28.848],[-112.531,28.894],[-112.47,29.168],[-112.424,29.204],[-112.285,29.24],[-112.263,29.207],[-112.249,29.126],[-112.203,29.005]],[[-118.243,28.942],[-118.285,28.904],[-118.4,29.112],[-118.401,29.163],[-118.368,29.188],[-118.312,29.183],[-118.312,29.131],[-118.266,29.086],[-118.247,29.043],[-118.243,28.942]],[[-86.714,21.239],[-86.696,21.191],[-86.714,21.197],[-86.736,21.233],[-86.753,21.279],[-86.727,21.264],[-86.714,21.239]],[[-91.684,18.677],[-91.796,18.654],[-91.816,18.676],[-91.589,18.778],[-91.55,18.774],[-91.537,18.76],[-91.654,18.711],[-91.684,18.677]],[[-109.805,24.151],[-109.827,24.148],[-109.878,24.201],[-109.9,24.331],[-109.89,24.345],[-109.794,24.183],[-109.796,24.164],[-109.805,24.151]],[[-114.694,31.706],[-114.727,31.701],[-114.789,31.747],[-114.785,31.79],[-114.709,31.757],[-114.688,31.724],[-114.694,31.706]],[[-111.1,26.021],[-111.088,25.985],[-111.135,25.999],[-111.204,25.85],[-111.225,25.836],[-111.183,26.041],[-111.139,26.07],[-111.091,26.076],[-111.1,26.021]],[[-111.699,24.394],[-111.712,24.346],[-112.013,24.533],[-111.941,24.551],[-111.857,24.538],[-111.699,24.394]],[[-112.057,24.546],[-112.077,24.535],[-112.163,24.65],[-112.175,24.73],[-112.21,24.763],[-112.297,24.79],[-112.222,24.951],[-112.159,25.286],[-112.132,25.224],[-112.198,24.885],[-112.195,24.841],[-112.164,24.8],[-112.13,24.73],[-112.126,24.654],[-112.067,24.584],[-112.057,24.546]]];
var DRY_ZONES = [[[-117.3, 33.0], [-114.3, 32.4], [-113.2, 28.0], [-111.0, 24.2], [-109.5, 22.9], [-112.0, 22.6], [-114.8, 25.5], [-116.5, 29.0], [-117.5, 31.2]], [[-115.8, 32.2], [-112.0, 31.6], [-110.2, 30.2], [-110.6, 28.6], [-112.6, 27.4], [-114.6, 28.0], [-115.6, 29.6], [-115.75, 31.0]], [[-108.6, 31.6], [-106.0, 31.0], [-103.6, 29.4], [-101.2, 26.6], [-100.2, 24.4], [-102.4, 22.6], [-104.8, 23.4], [-105.8, 25.4], [-107.6, 27.4], [-108.9, 29.8]]];
var RIA_RINGS = [[[-89.845, 21.283], [-89.8, 21.278], [-89.76, 21.27], [-89.72, 21.263], [-89.685, 21.257], [-89.66, 21.251], [-89.64, 21.249], [-89.638, 21.227], [-89.665, 21.216], [-89.7, 21.212], [-89.735, 21.211], [-89.77, 21.215], [-89.805, 21.228], [-89.83, 21.242]]];
var PIER_LINE = [[21.29, -89.6657], [21.3, -89.6663], [21.312, -89.6678], [21.325, -89.6699], [21.335, -89.6716], [21.342, -89.673]];
var PIER_SHIPS = [[21.315, -89.6742, "🚢", 34, 0], [21.33, -89.664, "⛴️", 30, 0.8], [21.34, -89.6785, "🛳️", 40, 1.6], [21.304, -89.6618, "🚤", 24, 0.4], [21.351, -89.68, "🚢", 36, 2.2]];

class TravelMapModule {
    constructor(options = {}) {
        this.map = options.map || null;

        this.geolocationManager = options.geolocationManager || null;
        this.config = options.config || {};
        
        this.attractions = [];
        this.proximityRadius = this.config.TRAVEL_PROXIMITY_RADIUS || 5000; // 5km default
        this.proximityCheckInterval = 10000; // 10 seconds
        this.proximityCheckTimer = null;
        this.triggeredAttractions = new Set();
        
        this.callbacks = {
            onProximityAlert: [],
            onAttractionEnter: [],
            onAttractionExit: []
        };
        
        // Cultural attraction data with icons
        this.culturalAttractions = [];
    }

    /**
     * Initialize travel map module
     */
    async init() {
        if (!this.map) {
            console.error('Map instance required for TravelMapModule');
            return false;
        }

        // Apply theme park map style if enabled
        if (this.config.TRAVEL_THEME_PARK_MODE) {
            this.applyThemeParkStyle();
        }

        // Load cultural attractions
        await this.loadAttractions();

        // Start proximity checking
        this.startProximityMonitoring();

        // Add attraction markers to map
        this.addAttractionMarkers();

        console.log('Travel map module initialized');
        return true;
    }

    /**
     * Apply illustrated theme park map style
     */
    applyThemeParkStyle() {
        // Custom tile layer with illustrated style
        const themeParkTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
            subdomains: 'abcd'
        });

        // Remove existing tile layers and add theme park style
        const map = this.map.getMap();
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        themeParkTiles.addTo(map);

        // Illustrated filter over the whole map container
        map.getContainer().classList.add('theme-park-mode');

        this.setupFoliage(map);
        this.addProgresoPier(map);
    }

    coastDist(lat, lng) {
        if (!this._segs) {
            this._segs = [];
            MEX_RINGS.forEach((ring) => {
                for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                    this._segs.push([ring[j][0], ring[j][1], ring[i][0], ring[i][1]]);
                }
            });
        }
        const cx = Math.cos(lat * Math.PI / 180);
        const px = lng * cx, py = lat;
        let best = Infinity;
        for (let k = 0; k < this._segs.length; k++) {
            const seg = this._segs[k];
            const ax = seg[0] * cx, ay = seg[1], bx = seg[2] * cx, by = seg[3];
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy;
            let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
            const d2 = ex * ex + ey * ey;
            if (d2 < best) best = d2;
        }
        return Math.sqrt(best);
    }

    inRia(lat, lng) {
        return RIA_RINGS.some((ring) => {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = ring[i][0], yi = ring[i][1];
                const xj = ring[j][0], yj = ring[j][1];
                if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
            }
            return inside;
        });
    }

    riaDist(lat, lng) {
        if (!this._riaSegs) {
            this._riaSegs = [];
            RIA_RINGS.forEach((ring) => {
                for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                    this._riaSegs.push([ring[j][0], ring[j][1], ring[i][0], ring[i][1]]);
                }
            });
        }
        const cx = Math.cos(lat * Math.PI / 180);
        const px = lng * cx, py = lat;
        let best = Infinity;
        for (let k = 0; k < this._riaSegs.length; k++) {
            const seg = this._riaSegs[k];
            const ax = seg[0] * cx, ay = seg[1], bx = seg[2] * cx, by = seg[3];
            const dx = bx - ax, dy = by - ay;
            const len2 = dx * dx + dy * dy;
            let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
            const d2 = ex * ex + ey * ey;
            if (d2 < best) best = d2;
        }
        return Math.sqrt(best);
    }

    isLand(lat, lng) {
        return MEX_RINGS.some((ring) => {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = ring[i][0], yi = ring[i][1];
                const xj = ring[j][0], yj = ring[j][1];
                if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
            }
            return inside;
        });
    }

    isDry(lat, lng) {
        return DRY_ZONES.some((ring) => {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = ring[i][0], yi = ring[i][1];
                const xj = ring[j][0], yj = ring[j][1];
                if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
            }
            return inside;
        });
    }

    setupFoliage(map) {
        if (!map.createPane || !L.divIcon) return;
        let pane = map.getPane('parkFoliage');
        if (!pane) {
            pane = map.createPane('parkFoliage');
            pane.style.zIndex = 450;
            pane.style.pointerEvents = 'none';
        }
        this._paneEl = pane;
        if (!this._foliageGroup) this._foliageGroup = L.layerGroup().addTo(map);
        if (!this._placedTrees) this._placedTrees = new Set();
        if (!this._rng) {
            let seed = 20260823;
            this._rng = () => {
                seed |= 0; seed = seed + 0x6D2B79F5 | 0;
                let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }
        const self = this;
        const TROPICAL = ['\ud83c\udf33', '\ud83c\udf33', '\ud83c\udf34', '\ud83c\udf34', '\ud83c\udf32', '\ud83c\udf3a', '\ud83c\udf3f', '\ud83c\udf38'];
        const ARID = ['\ud83c\udf35', '\ud83c\udf35', '\ud83c\udf35', '\ud83c\udf35', '\ud83e\udea8', '\ud83e\udd40', '\ud83c\udf3f'];
        function scatter() {
            try {
                const b = map.getBounds();
                if (!b) return;
                const south = b.getSouth(), north = b.getNorth(), west = b.getWest(), east = b.getEast();
                let placed = 0, tries = 0;
                while (placed < 14 && tries < 400) {
                    tries++;
                    const lat = south + self._rng() * (north - south);
                    const lng = west + self._rng() * (east - west);
                    const key = lat.toFixed(3) + ',' + lng.toFixed(3);
                    if (self._placedTrees.has(key)) continue;
                    if (!self.isLand(lat, lng)) continue;
                    if (self.coastDist(lat, lng) < 0.018) continue;
                    if (self.inRia(lat, lng) || self.riaDist(lat, lng) < 0.01) continue;
                    const dry = self.isDry(lat, lng);
                    const set = dry ? ARID : TROPICAL;
                    const emo = set[Math.floor(self._rng() * set.length)];
                    const size = 20 + Math.floor(self._rng() * 22);
                    self._placedTrees.add(key);
                    const mk = L.marker([lat, lng], {
                        pane: 'parkFoliage',
                        interactive: false,
                        keyboard: false,
                        icon: L.divIcon({
                            className: '',
                            html: '<span style="font-size:' + size + 'px;line-height:1;display:inline-block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.28))">' + emo + '</span>',
                            iconSize: [size, size],
                            iconAnchor: [size / 2, size / 2]
                        })
                    });
                    mk.addTo(self._foliageGroup);
                    mk._kind = 'tree';
                    placed++;
                }
            } catch (err) { console.warn('[travel] foliage skipped:', err && err.message); }
        }
        function place(kind, lat, lng, emojis, smin, srange) {
            const key = kind + lat.toFixed(3) + ',' + lng.toFixed(3);
            if (self._placedTrees.has(key)) return false;
            self._placedTrees.add(key);
            const emo = emojis[Math.floor(self._rng() * emojis.length)];
            const size = smin + Math.floor(self._rng() * srange);
            const mk = L.marker([lat, lng], {
                pane: 'parkFoliage',
                interactive: false,
                keyboard: false,
                icon: L.divIcon({
                    className: '',
                    html: '<span style="font-size:' + size + 'px;line-height:1;display:inline-block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))">' + emo + '</span>',
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                })
            }).addTo(self._foliageGroup);
            mk._kind = kind;
            return true;
        }
        function fauna(kind, quota, band, emojis, smin, srange) {
            let n = 0, tr = 0;
            while (n < quota && tr < 70) {
                tr++;
                const b = map.getBounds();
                const lat = b.getSouth() + self._rng() * (b.getNorth() - b.getSouth());
                const lng = b.getWest() + self._rng() * (b.getEast() - b.getWest());
                let ok;
                if (kind === 'flam') {
                    ok = self.isLand(lat, lng) || self.inRia(lat, lng);
                    if (!self.inRia(lat, lng)) {
                        if (!self.isLand(lat, lng)) continue;
                        const cd = self.coastDist(lat, lng);
                        if (cd > band[0] || cd < band[1]) continue;
                    }
                    else ok = true;
                } else {
                    if (self.isLand(lat, lng)) continue;
                    const cd = self.coastDist(lat, lng);
                    if (cd > band[0] || cd < band[1]) continue;
                    ok = true;
                }
                if (!ok) continue;
                if (place(kind, lat, lng, emojis, smin, srange)) n++;
            }
        }
        function mangroves(quota) {
            let n = 0, tr = 0;
            while (n < quota && tr < 90) {
                tr++;
                const b = map.getBounds();
                const lat = b.getSouth() + self._rng() * (b.getNorth() - b.getSouth());
                const lng = b.getWest() + self._rng() * (b.getEast() - b.getWest());
                const rd = self.riaDist(lat, lng);
                if (rd > 0.013) continue;
                if (self.inRia(lat, lng) ? rd > 0.006 : !self.isLand(lat, lng)) continue;
                if (place('mng', lat, lng, ['\ud83c\udf3f', '\ud83c\udf33', '\ud83e\udeb4'], 18, 10)) n++;
            }
        }
        function flamFlock(quota) {
            let n = 0, tr = 0;
            while (n < quota && tr < 90) {
                tr++;
                const lat = 21.205 + self._rng() * 0.085;
                const lng = -89.845 + self._rng() * 0.125;
                if (!self.inRia(lat, lng)) continue;
                if (place('flam', lat, lng, ['\ud83e\udda9'], 24, 12)) n++;
            }
        }
        function dinoFlock(quota) {
            let n = 0, tr = 0;
            while (n < quota && tr < 90) {
                tr++;
                const lat = 21.287 + self._rng() * 0.04;
                const lng = -89.535 + self._rng() * 0.05;
                if (!self.isLand(lat, lng)) continue;
                if (place('dino', lat, lng, ['\ud83e\udd95', '\ud83e\udd96'], 26, 12)) n++;
            }
        }
        dinoFlock(4);
        flamFlock(5);
        fauna('flam', 3, [0.055, 0], ['\ud83e\udda9'], 26, 10);
        fauna('pel', 2, [0.09, 0.008], ['\ud83e\udd85', '\ud83d\udc26'], 24, 8);
        mangroves(6);
        scatter();
        if (!this._foliageBound) {
            this._foliageBound = true;
            let deb;
            const onMove = () => { clearTimeout(deb); deb = setTimeout(scatter, 250); };
            map.on('moveend', onMove);
            map.on('zoomend', onMove);
        }
    }

    addProgresoPier(map) {
        if (!map || !L.polyline || !L.divIcon) return;
        let pane = map.getPane('pierPane');
        if (!pane) {
            pane = map.createPane('pierPane');
            pane.style.zIndex = 455;
            pane.style.pointerEvents = 'none';
        }
        if (!document.getElementById('park-bob-style')) {
            const st = document.createElement('style');
            st.id = 'park-bob-style';
            st.textContent = '@keyframes parkBob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-2.5px) rotate(2deg)}}' +
                '.pier-ship span{display:inline-block;animation:parkBob 3.2s ease-in-out infinite}';
            document.head.appendChild(st);
        }
        if (this._pierDone) return;
        this._pierDone = true;
        L.polyline(PIER_LINE, { pane: 'pierPane', color: '#ffffff', weight: 12, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(map);
        L.polyline(PIER_LINE, { pane: 'pierPane', color: '#e8930c', weight: 6, dashArray: '16 10', lineCap: 'round', interactive: false }).addTo(map);
        PIER_SHIPS.forEach(function (sh) {
            const lat = sh[0], lng = sh[1], emo = sh[2], size = sh[3], delay = sh[4];
            L.marker([lat, lng], {
                pane: 'pierPane',
                interactive: false,
                keyboard: false,
                icon: L.divIcon({
                    className: 'pier-ship',
                    html: '<span style="font-size:' + size + 'px;line-height:1;display:inline-block;animation-delay:' + delay + 's;filter:drop-shadow(0 2px 3px rgba(0,0,0,.32))">' + emo + '</span>',
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                })
            }).addTo(map);
        });
        L.marker([21.3432, -89.6729], {
            pane: 'pierPane',
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
                className: '',
                html: '<div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(160deg,#fef9c3,#fbbf24);border:3px solid #fff;box-shadow:0 3px 8px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;font-size:24px">' + '\ud83d\uded3' + '</div>',
                iconSize: [46, 46],
                iconAnchor: [23, 23]
            })
        }).addTo(map);
    }

    /**
     * Load cultural attractions from database or config
     */
    async loadAttractions() {
        // Try to load from PocketBase first (scoped to this town)
        try {
            const townId = window.APP_CONFIG?.TOWN_ID;
            const options = townId
                ? { filter: `town.town_id = "${townId}"` }
                : {};

            if (window.realtimeManager && window.realtimeManager.isConnected()) {
                const attractions = await window.realtimeManager.getRecords('attractions', options);
                if (attractions && attractions.length > 0) {
                    this.attractions = attractions;
                    console.log(`Loaded ${attractions.length} attractions from database`);
                    return;
                }
            }
        } catch (error) {
            console.log('Could not load attractions from database, using defaults');
        }

        // Use default cultural attractions
        this.attractions = this.culturalAttractions;
    }

    /**
     * Add attraction markers to map
     */
    addAttractionMarkers() {
        this.attractions.forEach(attraction => {
            const marker = this.map.updateMarker(
                attraction.id,
                attraction.latitude,
                attraction.longitude,
                {
                    appType: 'travel',
                    entityType: attraction.type,
                    ...((attraction.icon && attraction.id && /\.(png|jpe?g|svg|webp|gif)$/i.test(attraction.icon)) ? { customIconUrl: `/api/files/attractions/${attraction.id}/${attraction.icon}` } : {}),
                    popupContent: `
                        <div class="proximity-popup">
                            <h3>${attraction.name}</h3>
                            <p>${attraction.description || ''}</p>
                            <p class="distance">${Math.round(attraction.distance || 0)}m away</p>
                        </div>
                    `
                }
            );

            // Store reference for distance updates
            attraction.marker = marker;
        });
    }

    /**
     * Start proximity monitoring
     */
    startProximityMonitoring() {
        // Clear existing timer
        if (this.proximityCheckTimer) {
            clearInterval(this.proximityCheckTimer);
        }

        // Start periodic checks
        this.proximityCheckTimer = setInterval(() => {
            this.checkProximity();
        }, this.proximityCheckInterval);

        // Also check on location updates
        if (this.geolocationManager) {
            this.geolocationManager.onPositionUpdate((position) => {
                this.checkProximity(position);
            });
        }
    }

    /**
     * Stop proximity monitoring
     */
    stopProximityMonitoring() {
        if (this.proximityCheckTimer) {
            clearInterval(this.proximityCheckTimer);
            this.proximityCheckTimer = null;
        }
    }

    /**
     * Check proximity to all attractions
     */
    checkProximity(position = null) {
        // Get current position
        let currentPosition;
        if (position) {
            currentPosition = position;
        } else if (this.geolocationManager) {
            currentPosition = this.geolocationManager.getPosition();
        }

        if (!currentPosition) {
            return;
        }

        const { latitude, longitude } = currentPosition;

        // Check each attraction
        this.attractions.forEach(attraction => {
            const userLatLng = L.latLng(latitude, longitude);
            const attractionLatLng = L.latLng(attraction.latitude, attraction.longitude);
            const distance = userLatLng.distanceTo(attractionLatLng);

            // Update marker popup with distance
            if (attraction.marker) {
                const popupContent = attraction.marker.getPopup();
                if (popupContent) {
                    const content = popupContent.getContent();
                    const updatedContent = content.replace(
                        /<p class="distance">.*?<\/p>/,
                        `<p class="distance">${Math.round(distance)}m away</p>`
                    );
                    popupContent.setContent(updatedContent);
                }
            }

            // Check if within proximity radius
            const radius = attraction.proximityRadius || this.proximityRadius;
            const attractionKey = attraction.id;

            if (distance <= radius && !this.triggeredAttractions.has(attractionKey)) {
                // User entered attraction proximity
                this.triggerProximityAlert(attraction, distance);
                this.triggeredAttractions.add(attractionKey);
                this.notifyCallbacks('onAttractionEnter', { attraction, distance });
            } else if (distance > radius && this.triggeredAttractions.has(attractionKey)) {
                // User exited attraction proximity
                this.triggeredAttractions.delete(attractionKey);
                this.notifyCallbacks('onAttractionExit', { attraction, distance });
            }
        });
    }

    /**
     * Trigger proximity alert for attraction
     */
    triggerProximityAlert(attraction, distance) {
        console.log(`Proximity alert: ${attraction.name} (${Math.round(distance)}m away)`);

        // Show animated icon on map
        this.showAnimatedAttractionIcon(attraction);

        // Notify callbacks
        this.notifyCallbacks('onProximityAlert', {
            attraction: attraction,
            distance: distance
        });

        // Show notification to user
        this.showProximityNotification(attraction, distance);
    }

    /**
     * Show animated attraction icon on map
     */
    showAnimatedAttractionIcon(attraction) {
        // Create or update the proximity alert marker
        const alertData = {
            name: attraction.name,
            description: attraction.description,
            type: attraction.type,
            icon: attraction.icon,
            distance: Math.round(this.calculateDistance(
                this.geolocationManager.getPosition().latitude,
                this.geolocationManager.getPosition().longitude,
                attraction.latitude,
                attraction.longitude
            ))
        };

        // Add large animated icon
        this.map.addProximityAlert(
            `alert_${attraction.id}`,
            attraction.latitude,
            attraction.longitude,
            alertData
        );

        // NOTE: intentionally does NOT pan the map here - the user may be
        // panning around exploring; yanking the view made exploration
        // impossible. The animated icon + notification are enough.
    }

    /**
     * Show proximity notification to user
     */
    showProximityNotification(attraction, distance) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'proximity-notification';
        notification.innerHTML = `
            <div class="proximity-content">
                <div class="proximity-icon">${attraction.icon}</div>
                <div class="proximity-text">
                    <h3>${attraction.name}</h3>
                    <p>${attraction.description}</p>
                    <p class="distance">${Math.round(distance)}m away</p>
                </div>
                <button class="proximity-close">&times;</button>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 16px;
            animation: slide-up 0.5s ease;
            max-width: 90%;
            width: 350px;
        `;

        // Add to document
        document.body.appendChild(notification);

        // Setup close button
        const closeBtn = notification.querySelector('.proximity-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'slide-down 0.5s ease forwards';
            setTimeout(() => notification.remove(), 500);
        });

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slide-down 0.5s ease forwards';
                setTimeout(() => notification.remove(), 500);
            }
        }, 10000);
    }

    /**
     * Calculate distance between two coordinates
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    /**
     * Add custom attraction
     */
    addCustomAttraction(attractionData) {
        const newAttraction = {
            id: `custom_${Date.now()}`,
            name: attractionData.name,
            type: attractionData.type || 'custom',
            icon: attractionData.icon || '📍',
            latitude: attractionData.latitude,
            longitude: attractionData.longitude,
            description: attractionData.description,
            proximityRadius: attractionData.proximityRadius || this.proximityRadius
        };

        this.attractions.push(newAttraction);
        this.addAttractionMarkers();

        return newAttraction;
    }

    /**
     * Remove attraction
     */
    removeAttraction(attractionId) {
        const index = this.attractions.findIndex(a => a.id === attractionId);
        if (index > -1) {
            const attraction = this.attractions[index];
            
            // Remove marker from map
            if (attraction.marker) {
                this.map.removeMarker(attraction.id);
            }

            // Remove from array
            this.attractions.splice(index, 1);
            this.triggeredAttractions.delete(attractionId);
        }
    }

    /**
     * Get all attractions
     */
    getAttractions() {
        return this.attractions;
    }

    /**
     * Get attraction by ID
     */
    getAttraction(attractionId) {
        return this.attractions.find(a => a.id === attractionId);
    }

    /**
     * Set proximity radius
     */
    setProximityRadius(radius) {
        this.proximityRadius = radius;
    }

    /**
     * Register callback for proximity alerts
     */
    onProximityAlert(callback) {
        this.callbacks.onProximityAlert.push(callback);
    }

    /**
     * Register callback for attraction enter
     */
    onAttractionEnter(callback) {
        this.callbacks.onAttractionEnter.push(callback);
    }

    /**
     * Register callback for attraction exit
     */
    onAttractionExit(callback) {
        this.callbacks.onAttractionExit.push(callback);
    }

    /**
     * Notify all registered callbacks
     */
    notifyCallbacks(eventType, data) {
        if (this.callbacks[eventType]) {
            this.callbacks[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventType} callback:`, error);
                }
            });
        }
    }

    /**
     * Destroy travel map module
     */
    destroy() {
        this.stopProximityMonitoring();
        this.triggeredAttractions.clear();
        this.callbacks = {
            onProximityAlert: [],
            onAttractionEnter: [],
            onAttractionExit: []
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TravelMapModule;
}
