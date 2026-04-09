var merge = function (nums1, m, nums2, n) {
    nums1 = nums1.slice(0, m)
    for (let i = 0; i < n; i++) {
        nums1.push(nums2[i])
    }
    nums1.sort((a, b) => a - b)
};
console.log("🚀 ~ merge ~ merge:", merge([1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3))

